"""
Participants app views
"""
from rest_framework import viewsets, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db import models as db_models
from django.utils import timezone

from .models import Participant, Registration, WaitlistPromotion
from programs.models import Program
from core.models_user import AuditLog
from core.permissions import IsProgramCoordinatorOrAbove, IsProgramAdminOrAbove, HasProgramScope
from .serializers import (
    ParticipantSerializer, ParticipantDetailSerializer,
    RegistrationSerializer, RegistrationApprovalSerializer,
    WaitlistPromotionSerializer, StatusMatrixSerializer,
    ParticipantOverrideSerializer,
)


class ParticipantViewSet(viewsets.ModelViewSet):
    serializer_class = ParticipantSerializer
    permission_classes = [IsProgramCoordinatorOrAbove]

    def get_queryset(self):
        qs = Participant.objects.select_related(
            'department', 'designation'
        ).all()
        search = self.request.query_params.get('search')
        department = self.request.query_params.get('department')
        if search:
            qs = qs.filter(
                db_models.Q(full_name__icontains=search) |
                db_models.Q(email__icontains=search) |
                db_models.Q(mobile__icontains=search)
            )
        if department:
            qs = qs.filter(department_id=department)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ParticipantDetailSerializer
        return ParticipantSerializer


class RegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = RegistrationSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = Registration.objects.select_related(
            'program', 'participant'
        ).all()
        program_id = self.request.query_params.get('program')
        reg_status = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if reg_status:
            qs = qs.filter(status=reg_status)
        if search:
            qs = qs.filter(
                db_models.Q(registration_number__icontains=search) |
                db_models.Q(participant__full_name__icontains=search) |
                db_models.Q(participant__email__icontains=search)
            )
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        reg = self.get_object()
        if reg.status != 'SUBMITTED':
            return Response({'error': {'code': 'CONFLICT', 'message': f'Cannot approve: status is {reg.status}'}},
                            status=status.HTTP_409_CONFLICT)
        reg.status = 'APPROVED'
        reg.approved_by = request.user
        from django.utils import timezone
        reg.approved_at = timezone.now()
        reg.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='approve_registration',
            entity_type='Registration', entity_id=reg.id,
            before={'status': 'SUBMITTED'}, after={'status': 'APPROVED'},
            program_id=reg.program_id
        )
        return Response({'message': 'Registration approved', 'status': reg.status})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        reg = self.get_object()
        reason = request.data.get('reason', '')
        reg.status = 'REJECTED'
        reg.rejection_reason = reason
        reg.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='reject_registration',
            entity_type='Registration', entity_id=reg.id,
            before={'status': 'SUBMITTED'}, after={'status': 'REJECTED', 'reason': reason},
            program_id=reg.program_id
        )
        return Response({'message': 'Registration rejected'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        reg = self.get_object()
        reg.status = 'CANCELLED'
        reg.save(update_fields=['status', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='cancel_registration',
            entity_type='Registration', entity_id=reg.id,
            after={'status': 'CANCELLED'}, program_id=reg.program_id
        )
        return Response({'message': 'Registration cancelled'})


class WaitlistPromotionViewSet(viewsets.ModelViewSet):
    serializer_class = WaitlistPromotionSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = WaitlistPromotion.objects.select_related(
            'registration', 'registration__participant', 'promoted_by'
        ).all()
        program_id = self.request.query_params.get('program')
        if program_id:
            qs = qs.filter(registration__program_id=program_id)
        return qs

    def perform_create(self, serializer):
        reg = serializer.validated_data['registration']
        prev_position = reg.waitlist_position
        reg.status = 'APPROVED'
        reg.waitlist_position = None
        from django.utils import timezone
        reg.promoted_at = timezone.now()
        reg.promoted_by = self.request.user
        reg.approved_by = self.request.user
        reg.approved_at = timezone.now()
        reg.save(update_fields=[
            'status', 'waitlist_position', 'promoted_at', 'promoted_by',
            'approved_by', 'approved_at', 'updated_at'
        ])
        serializer.save(promoted_by=self.request.user, previous_position=prev_position)


class ProgramParticipantViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]
    serializer_class = ParticipantDetailSerializer

    def get_queryset(self):
        program_id = self.kwargs.get('program_id')
        return Participant.objects.filter(
            registrations__program_id=program_id,
            registrations__status__in=['APPROVED', 'SUBMITTED']
        ).select_related('department', 'designation')


class StatusMatrixView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        registrations = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        ).select_related('participant', 'participant__department')
        days = program.days.order_by('day_number')
        matrix = []
        for reg in registrations:
            p = reg.participant
            att_data = {}
            for day in days:
                att = program.attendance_records.filter(
                    participant=p, day=day, is_present=True
                ).exists()
                att_data[str(day.id)] = {
                    'present': att,
                    'late': program.attendance_records.filter(
                        participant=p, day=day, is_late=True
                    ).exists(),
                }
            food_data = {}
            from food.models import FoodEligibility
            for day in days:
                elig = FoodEligibility.objects.filter(
                    food_service__program=program,
                    food_service__day=day,
                    participant=p
                ).first()
                food_data[str(day.id)] = {
                    'eligible': elig.is_eligible if elig else False,
                    'qr_sent': elig.qr_sent if elig else False,
                    'claimed': elig.food_token.is_claimed if elig and hasattr(elig, 'food_token') else False,
                }
            from feedback.models import FeedbackResponse
            fb_submitted = FeedbackResponse.objects.filter(
                feedback_instance__program=program, participant=p
            ).exists()
            from certificates.models import Certificate
            cert = Certificate.objects.filter(program=program, participant=p).first()
            matrix.append({
                'participant_id': str(p.id),
                'participant_name': p.full_name,
                'participant_email': p.email,
                'department': p.department.name if p.department else '',
                'registration_status': reg.status,
                'registration_number': reg.registration_number,
                'attendance': att_data,
                'food': food_data,
                'feedback': {'submitted': fb_submitted},
                'certificate': {
                    'status': cert.status if cert else None,
                    'number': cert.certificate_number if cert else None,
                },
            })
        return Response({
            'program': {
                'id': str(program.id),
                'title': program.title,
                'short_code': program.short_code,
            },
            'days': [{
                'id': str(d.id),
                'day_number': d.day_number,
                'date': str(d.date),
                'attendance_enabled': d.attendance_enabled,
                'food_enabled': d.food_enabled,
            } for d in days],
            'participants': matrix,
        })


class StatusMatrixExportView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        # Trigger async export
        from reports.tasks import generate_export
        job = generate_export.delay(str(program_id), 'PARTICIPANT_STATUS', [], {}, 'XLSX')
        return Response({'job_id': job.id, 'message': 'Export queued'})


class ParticipantOverrideView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request, participant_id):
        serializer = ParticipantOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participant = Participant.objects.get(id=participant_id)
        data = serializer.validated_data

        if data['override_type'] == 'attendance':
            program = Program.objects.get(id=request.data.get('program_id'))
            day_id = data.get('day_id')
            from attendance.models import AttendanceRecord, ProgramDay
            day = ProgramDay.objects.get(id=day_id)
            record, created = AttendanceRecord.objects.update_or_create(
                participant=participant, day=day,
                defaults={
                    'program': program,
                    'is_present': data['is_present'],
                    'source': 'MANUAL',
                    'scanned_by': request.user,
                    'program_date': day.date,
                    'correction_reason': data['reason'],
                    'is_corrected': True,
                    'corrected_by': request.user,
                    'corrected_at': timezone.now(),
                }
            )
            AuditLog.objects.create(
                user=request.user, action='override_attendance',
                entity_type='AttendanceRecord', entity_id=record.id,
                after={'is_present': data['is_present'], 'reason': data['reason']},
                program_id=program.id
            )
            return Response({'message': 'Attendance overridden'})

        elif data['override_type'] == 'eligibility':
            from food.models import FoodEligibility
            elig_id = request.data.get('eligibility_id')
            elig = FoodEligibility.objects.get(id=elig_id)
            elig.is_eligible = data['is_eligible']
            elig.save(update_fields=['is_eligible', 'updated_at'])
            return Response({'message': 'Eligibility overridden'})

        return Response({'error': 'Invalid override type'}, status=400)