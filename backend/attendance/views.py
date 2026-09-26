"""
Attendance app views
"""
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .models import AttendanceRecord, AttendanceSession, AttendanceGate
from programs.models import Program, ProgramDay
from participants.models import Participant, Registration
from core.models_user import AuditLog
from core.permissions import IsAttendanceOperator, HasProgramScope, IsProgramAdminOrAbove
from .serializers import (
    AttendanceRecordSerializer, MarkAttendanceSerializer, AttendanceSessionSerializer,
    AttendanceGateSerializer, AttendanceStatsSerializer, AttendanceRosterSerializer,
    SelfQrResponseSerializer,
)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    def get_queryset(self):
        qs = AttendanceRecord.objects.select_related(
            'participant', 'program', 'day', 'scanned_by'
        ).all()
        program_id = self.request.query_params.get('program')
        day_id = self.request.query_params.get('day')
        participant_id = self.request.query_params.get('participant')
        is_present = self.request.query_params.get('is_present')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if day_id:
            qs = qs.filter(day_id=day_id)
        if participant_id:
            qs = qs.filter(participant_id=participant_id)
        if is_present is not None:
            qs = qs.filter(is_present=is_present.lower() == 'true')
        return qs.order_by('-marked_at')


class AttendanceSessionViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSessionSerializer
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    def get_queryset(self):
        qs = AttendanceSession.objects.select_related('program', 'day').all()
        program_id = self.request.query_params.get('program')
        att_status = self.request.query_params.get('status')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if att_status:
            qs = qs.filter(status=att_status)
        return qs

    @action(detail=True, methods=['post'])
    def open(self, request, pk=None):
        session = self.get_object()
        from django.utils import timezone
        session.status = AttendanceSession.Status.ACTIVE
        session.opened_by = request.user
        session.opened_at = timezone.now()
        session.expected_participants = session.program.registrations.filter(
            status__in=['APPROVED', 'SUBMITTED']
        ).count()
        session.save()
        AuditLog.objects.create(
            user=request.user, action='open_attendance',
            entity_type='AttendanceSession', entity_id=session.id,
            after={'status': 'ACTIVE'}, program_id=session.program_id
        )
        return Response({'message': 'Attendance session opened', 'expected': session.expected_participants})

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        session = self.get_object()
        from django.utils import timezone
        session.status = AttendanceSession.Status.CLOSED
        session.closed_by = request.user
        session.closed_at = timezone.now()
        session.save()
        AuditLog.objects.create(
            user=request.user, action='close_attendance',
            entity_type='AttendanceSession', entity_id=session.id,
            after={'status': 'CLOSED'}, program_id=session.program_id
        )
        return Response({'message': 'Attendance session closed'})

    @action(detail=True, methods=['get'])
    def gates(self, request, pk=None):
        session = self.get_object()
        gates = session.gates.all()
        return Response(AttendanceGateSerializer(gates, many=True).data)


class AttendanceGateViewSet(viewsets.ModelViewSet):
    queryset = AttendanceGate.objects.all()
    serializer_class = AttendanceGateSerializer
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    def get_queryset(self):
        qs = super().get_queryset().select_related('session', 'operator')
        session_id = self.request.query_params.get('session')
        if session_id:
            qs = qs.filter(session_id=session_id)
        return qs


class MarkAttendanceView(APIView):
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    @extend_schema(
        request=MarkAttendanceSerializer,
        responses={
            200: OpenApiResponse(description='Already marked'),
            201: OpenApiResponse(description='Marked'),
            403: OpenApiResponse(description='Forbidden'),
            404: OpenApiResponse(description='Not found'),
            409: OpenApiResponse(description='Attendance not enabled'),
        },
        tags=['Attendance'],
    )
    def post(self, request, program_id, day_id):
        serializer = MarkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            program = Program.objects.get(id=program_id)
            day = ProgramDay.objects.get(id=day_id, program=program)
        except (Program.DoesNotExist, ProgramDay.DoesNotExist):
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Program or day not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        # Validate service enabled
        if not day.attendance_enabled:
            return Response({
                'error': {'code': 'CONFLICT', 'message': 'Attendance not enabled for this day'}
            }, status=status.HTTP_409_CONFLICT)

        # Find participant
        participant = None
        if data.get('token'):
            reg = Registration.objects.filter(
                attendance_token=data['token'], program=program
            ).first()
            participant = reg.participant if reg else None
            if not participant:
                # Token might be a food/attendance token
                from food.models import FoodToken
                ft = FoodToken.objects.filter(token=data['token']).first()
                if ft and ft.food_service.program == program:
                    participant = ft.participant
        elif data.get('participant_id'):
            participant = Participant.objects.filter(id=data['participant_id']).first()
        elif data.get('registration_number'):
            reg = Registration.objects.filter(
                registration_number=data['registration_number'], program=program
            ).first()
            participant = reg.participant if reg else None

        if not participant:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Participant not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        # Validate registration
        reg = Registration.objects.filter(program=program, participant=participant).first()
        if not reg or reg.status not in ['APPROVED', 'SUBMITTED']:
            return Response({
                'error': {'code': 'FORBIDDEN', 'message': 'Participant not registered or not approved'}
            }, status=status.HTTP_403_FORBIDDEN)

        # Idempotent: use get_or_create
        record, created = AttendanceRecord.objects.get_or_create(
            participant=participant, day=day,
            defaults={
                'program': program,
                'registration': reg,
                'is_present': True,
                'is_late': data.get('is_late', False),
                'source': 'SCAN' if data.get('token') else 'MANUAL',
                'scanned_by': request.user,
                'gate_name': data.get('gate_name', ''),
                'program_date': day.date,
            }
        )

        if not created:
            # Already marked - update late flag if not set
            if data.get('is_late') and not record.is_late:
                record.is_late = True
                record.save(update_fields=['is_late', 'updated_at'])
            return Response({
                'result': 'already_marked',
                'message': 'Attendance already marked',
                'participant_name': participant.full_name,
                'marked_at': record.marked_at,
            }, status=status.HTTP_200_OK)

        return Response({
            'result': 'marked',
            'message': 'Attendance marked',
            'participant_name': participant.full_name,
            'marked_at': record.marked_at,
        }, status=status.HTTP_201_CREATED)


class DayAttendanceView(APIView):
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    @extend_schema(
        responses={
            200: AttendanceRecordSerializer(many=True),
            404: OpenApiResponse(description='Not found'),
        },
        tags=['Attendance'],
    )
    def get(self, request, program_id, day_id):
        day = ProgramDay.objects.get(id=day_id, program_id=program_id)
        records = AttendanceRecord.objects.filter(
            program_id=program_id, day=day
        ).select_related('participant')
        return Response(AttendanceRecordSerializer(records, many=True, context={'request': request}).data)


class DayAttendanceSelfQrView(APIView):
    """Admin endpoint: returns a self check-in QR that opens the attendance form for a day."""
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    @extend_schema(
        responses={
            200: SelfQrResponseSerializer,
            404: OpenApiResponse(description='Not found'),
        },
        tags=['Attendance'],
    )
    def get(self, request, program_id, day_id):
        from core.notifications import _public_site_url
        import qrcode
        import io
        import base64 as b64

        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)

        base = _public_site_url()
        url = f"{base}/p/{program.public_token}/attendance/?day={day.id}" if base else ''
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format='PNG')

        return Response({
            'program_id': str(program.id),
            'program_title': program.title,
            'short_code': program.short_code,
            'day_id': str(day.id),
            'day_number': day.day_number,
            'day_date': str(day.date),
            'attendance_enabled': day.attendance_enabled,
            'url': url,
            'qr': b64.b64encode(buf.getvalue()).decode(),
        })


class AttendanceRosterView(APIView):
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    @extend_schema(
        responses={
            200: AttendanceRosterSerializer(many=True),
            404: OpenApiResponse(description='Not found'),
        },
        tags=['Attendance'],
    )
    def get(self, request, program_id, day_id):
        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)
        regs = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        ).select_related('participant').order_by(
            'participant__full_name', 'participant__id'
        )
        marked = AttendanceRecord.objects.filter(
            day=day, is_present=True
        ).values_list('participant_id', flat=True)

        roster = []
        for reg in regs:
            marked_record = AttendanceRecord.objects.filter(day=day, participant=reg.participant).first()
            roster.append({
                'participant_id': str(reg.participant.id),
                'participant_name': reg.participant.full_name,
                'participant_email': reg.participant.email,
                'registration_number': reg.registration_number,
                'is_present': reg.participant.id in marked,
                'is_late': marked_record.is_late if marked_record else False,
                'marked_at': marked_record.marked_at if marked_record else None,
                'scanned_by': marked_record.scanned_by.get_full_name() if marked_record and marked_record.scanned_by else '',
            })
        return Response(AttendanceRosterSerializer(roster, many=True).data)


class AttendanceStatsView(APIView):
    permission_classes = [IsAttendanceOperator, HasProgramScope]

    @extend_schema(
        responses={
            200: AttendanceStatsSerializer,
            404: OpenApiResponse(description='Not found'),
        },
        tags=['Attendance'],
    )
    def get(self, request, program_id, day_id):
        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)
        total_expected = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        ).count()
        present = AttendanceRecord.objects.filter(day=day, is_present=True).count()
        late = AttendanceRecord.objects.filter(day=day, is_present=True, is_late=True).count()
        absent = max(0, total_expected - present)
        rate = (present / total_expected * 100) if total_expected > 0 else 0
        return Response({
            'total_expected': total_expected,
            'present': present,
            'absent': absent,
            'late': late,
            'attendance_rate': round(rate, 2),
        })