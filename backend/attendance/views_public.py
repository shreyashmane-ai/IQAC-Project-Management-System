"""
Attendance public views (operator scan)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .models import AttendanceRecord, AttendanceSession, AttendanceGate
from programs.models import Program, ProgramDay
from participants.models import Registration
from core.models_user import AuditLog
from core.permissions import IsAttendanceOperator
from core.throttling import PublicRegisterThrottle, OperatorScanThrottle
from .serializers import AttendanceRecordSerializer
from rest_framework import serializers
from drf_spectacular.utils import extend_schema, OpenApiResponse


class SelfAttendanceRequestSerializer(serializers.Serializer):
    registration_number = serializers.CharField()
    email = serializers.EmailField()
    day_id = serializers.UUIDField()


class SelfAttendanceResponseSerializer(serializers.Serializer):
    result = serializers.CharField()
    participant = serializers.DictField()
    day = serializers.DictField()
    message = serializers.CharField()


class AttendanceScanRequestSerializer(serializers.Serializer):
    attendance_token = serializers.CharField()
    day_id = serializers.UUIDField()
    session_id = serializers.UUIDField(required=False)
    gate_name = serializers.CharField(required=False, default='')
    device_info = serializers.DictField(required=False)


class AttendanceScanResponseSerializer(serializers.Serializer):
    result = serializers.CharField()
    participant = serializers.DictField()
    day = serializers.IntegerField()
    date = serializers.DateField()
    is_present = serializers.BooleanField()
    message = serializers.CharField()


class SelfAttendanceView(APIView):
    """Public self check-in: participant enters registration number + email to mark attendance."""
    permission_classes = []
    throttle_classes = [PublicRegisterThrottle]

    @staticmethod
    def _get_program(token):
        try:
            return Program.objects.get(public_token=token)
        except Program.DoesNotExist:
            return None

    @extend_schema(
        responses={200: OpenApiResponse(description='Program info'), 404: OpenApiResponse(description='Program not found')},
        tags=['Public Attendance'],
    )
    def get(self, request, token):
        program = self._get_program(token)
        if not program:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Program not found'}},
                            status=status.HTTP_404_NOT_FOUND)
        return Response({
            'program': {
                'id': str(program.id),
                'title': program.title,
                'short_code': program.short_code,
            },
        })

    @extend_schema(
        request=SelfAttendanceRequestSerializer,
        responses={
            200: SelfAttendanceResponseSerializer,
            400: OpenApiResponse(description='Validation error'),
            403: OpenApiResponse(description='Disabled or session not active'),
            404: OpenApiResponse(description='Not found'),
        },
        tags=['Public Attendance'],
    )
    @transaction.atomic
    def post(self, request, token):
        program = self._get_program(token)
        if not program:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Program not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        reg_no = (request.data.get('registration_number') or '').strip()
        email = (request.data.get('email') or '').strip()
        day_id = request.data.get('day_id')

        if not reg_no or not email or not day_id:
            return Response({'error': {'code': 'VALIDATION', 'message': 'registration_number, email and day are required'}},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            day = ProgramDay.objects.get(id=day_id, program=program)
        except ProgramDay.DoesNotExist:
            return Response({'error': {'code': 'INVALID_DAY', 'message': 'Invalid day for this program'}},
                            status=status.HTTP_404_NOT_FOUND)

        if not day.attendance_enabled:
            return Response({'error': {'code': 'DISABLED', 'message': 'Attendance not enabled for this day'}},
                            status=status.HTTP_403_FORBIDDEN)

        session = getattr(day, 'attendance_session', None)
        if session is not None and session.status != AttendanceSession.Status.ACTIVE:
            return Response({'error': {'code': 'SESSION', 'message': 'Attendance is not open right now'}},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            reg = Registration.objects.select_related('participant').get(
                program=program,
                registration_number__iexact=reg_no,
                participant__email__iexact=email,
                status__in=['APPROVED', 'SUBMITTED'],
            )
        except Registration.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Registration number and email do not match.'}},
                            status=status.HTTP_404_NOT_FOUND)

        record, created = AttendanceRecord.objects.update_or_create(
            participant=reg.participant, day=day,
            defaults={
                'program': program,
                'registration': reg,
                'is_present': True,
                'source': AttendanceRecord.Source.SELF,
                'gate_name': 'Self check-in',
                'device_info': {
                    'ip': request.META.get('REMOTE_ADDR', ''),
                    'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
                },
                'program_date': day.date,
            }
        )

        result = 'MARKED' if created else 'ALREADY_MARKED'
        AuditLog.objects.create(
            user=None, action='self_attendance',
            entity_type='AttendanceRecord', entity_id=record.id,
            after={'result': result}, program_id=program.id,
        )
        return Response({
            'result': result,
            'participant': {
                'name': reg.participant.full_name,
                'email': reg.participant.email,
                'registration_number': reg.registration_number,
            },
            'day': {'day_number': day.day_number, 'date': str(day.date), 'title': day.title or ''},
            'message': 'Attendance marked' if created else 'Attendance already marked',
        })


class AttendanceScanView(APIView):
    """QR scan attendance marking - idempotent"""
    permission_classes = [IsAttendanceOperator]
    throttle_classes = [OperatorScanThrottle]

    @extend_schema(
        request=AttendanceScanRequestSerializer,
        responses={
            200: AttendanceScanResponseSerializer,
            400: OpenApiResponse(description='Validation error'),
            403: OpenApiResponse(description='Disabled or session not active'),
            404: OpenApiResponse(description='Not found'),
        },
        tags=['Public Attendance'],
    )
    @transaction.atomic
    def post(self, request):
        scan_data = request.data
        attendance_token = scan_data.get('attendance_token')
        day_id = scan_data.get('day_id')
        session_id = scan_data.get('session_id')
        gate_name = scan_data.get('gate_name', '')

        if not attendance_token or not day_id:
            return Response({'error': {'code': 'VALIDATION', 'message': 'attendance_token and day_id required'}},
                            status=status.HTTP_400_BAD_REQUEST)

        # Resolve registration by token
        try:
            reg = Registration.objects.select_related('program', 'participant').get(
                attendance_token=attendance_token,
                status__in=['APPROVED', 'SUBMITTED']
            )
        except Registration.DoesNotExist:
            return Response({'error': {'code': 'INVALID', 'message': 'Invalid or inactive QR code'}},
                            status=status.HTTP_404_NOT_FOUND)

        try:
            day = ProgramDay.objects.get(id=day_id, program=reg.program)
        except ProgramDay.DoesNotExist:
            return Response({'error': {'code': 'INVALID_DAY', 'message': 'Invalid day for this program'}},
                            status=status.HTTP_404_NOT_FOUND)

        if not day.attendance_enabled:
            return Response({'error': {'code': 'DISABLED', 'message': 'Attendance disabled for this day'}},
                            status=status.HTTP_403_FORBIDDEN)

        # Optionally check session is active
        if session_id:
            try:
                session = AttendanceSession.objects.get(id=session_id)
                if session.status != AttendanceSession.Status.ACTIVE:
                    return Response({'error': {'code': 'SESSION', 'message': 'Attendance session not active'}},
                                    status=status.HTTP_403_FORBIDDEN)
            except AttendanceSession.DoesNotExist:
                pass

        # Idempotent update_or_create by (participant, day)
        record, created = AttendanceRecord.objects.update_or_create(
            participant=reg.participant, day=day,
            defaults={
                'program': reg.program,
                'registration': reg,
                'is_present': True,
                'source': AttendanceRecord.Source.SCAN,
                'scanned_by': request.user,
                'gate_name': gate_name,
                'device_info': scan_data.get('device_info', {}),
                'program_date': day.date,
            }
        )

        result = 'MARKED' if created else 'ALREADY_MARKED'
        return Response({
            'result': result,
            'participant': {
                'name': reg.participant.full_name,
                'email': reg.participant.email,
                'registration_number': reg.registration_number,
            },
            'day': day.day_number,
            'date': day.date,
            'is_present': record.is_present,
            'message': 'Attendance recorded' if created else 'Attendance already marked',
        })