"""
Certificates app views
"""
import json
import secrets
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.utils import timezone
from django.conf import settings

from .models import (
    CertificateTemplate, CertificateConfig, Certificate, CertificateBatchJob,
)
from programs.models import Program
from participants.models import Participant, Registration
from attendance.models import AttendanceRecord
from core.models_user import AuditLog
from core.permissions import IsProgramCoordinatorOrAbove, HasProgramScope
from .serializers import (
    CertificateTemplateSerializer, CertificateConfigSerializer, CertificateSerializer,
    CertificateEligibleListSerializer, CertificateGenerateSerializer,
    CertificateBatchJobSerializer, CertificateVerifySerializer,
)


def _json_safe(data):
    """Return a JSON-serializable copy (UUIDs/objects -> str)."""
    return json.loads(json.dumps(data, default=str))


class CertificateTemplateViewSet(viewsets.ModelViewSet):
    queryset = CertificateTemplate.objects.all()
    serializer_class = CertificateTemplateSerializer
    permission_classes = [IsProgramCoordinatorOrAbove]


class CertificateConfigViewSet(viewsets.ModelViewSet):
    queryset = CertificateConfig.objects.select_related('program', 'template').all()
    serializer_class = CertificateConfigSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]


class CertificateViewSet(viewsets.ModelViewSet):
    serializer_class = CertificateSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = Certificate.objects.select_related(
            'program', 'participant', 'config'
        ).all()
        program_id = self.request.query_params.get('program')
        cert_status = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if cert_status:
            qs = qs.filter(status=cert_status)
        if search:
            qs = qs.filter(
                models.Q(certificate_number__icontains=search) |
                models.Q(participant__full_name__icontains=search)
            )
        return qs

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        cert = self.get_object()
        if cert.status == Certificate.Status.CANCELLED:
            return Response({'error': {'code': 'CONFLICT', 'message': 'Certificate already cancelled'}},
                            status=status.HTTP_409_CONFLICT)
        cert.status = Certificate.Status.CANCELLED
        cert.cancelled_by = request.user
        cert.cancelled_at = timezone.now()
        cert.cancellation_reason = request.data.get('reason', '')
        cert.save(update_fields=[
            'status', 'cancelled_by', 'cancelled_at', 'cancellation_reason', 'updated_at'
        ])
        AuditLog.objects.create(
            user=request.user, action='cancel_certificate',
            entity_type='Certificate', entity_id=cert.id,
            after={'status': 'CANCELLED', 'reason': cert.cancellation_reason}, program_id=cert.program_id
        )
        return Response({'message': 'Certificate cancelled'})

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        cert = self.get_object()
        from notifications.tasks import send_certificate_email
        send_certificate_email.delay(str(cert.id))
        return Response({'message': 'Certificate email queued for resend'})


class CertificateBatchJobViewSet(viewsets.ModelViewSet):
    serializer_class = CertificateBatchJobSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = CertificateBatchJob.objects.select_related('program').all()
        program_id = self.request.query_params.get('program')
        if program_id:
            qs = qs.filter(program_id=program_id)
        return qs


class ProgramCertificateConfigView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        config = CertificateConfig.objects.filter(program=program).first()
        if not config:
            return Response({'detail': 'No certificate config yet'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CertificateConfigSerializer(config).data)

    def put(self, request, program_id):
        program = Program.objects.get(id=program_id)
        defaults = {
            'eligibility_rule': request.data.get('eligibility_rule', {}),
        }
        if request.data.get('template'):
            defaults['template'] = CertificateTemplate.objects.get(
                id=request.data['template']
            )
        config, created = CertificateConfig.objects.get_or_create(
            program=program,
            defaults=defaults,
        )
        serializer = CertificateConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditLog.objects.create(
            user=request.user, action='update_certificate_config',
            entity_type='Program', entity_id=program.id,
            after=_json_safe(serializer.data), program_id=program.id
        )
        return Response(serializer.data)


class ProgramCertificateEligibleView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        config = CertificateConfig.objects.filter(program=program).first()
        if not config:
            return Response({'message': 'No certificate config'})

        registrations = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        ).select_related('participant')

        rule = config.eligibility_rule or {'type': 'attendance_percentage', 'min_percentage': 75}
        days_total = program.days.filter(is_cancelled=False).count()

        eligible_list = []
        for reg in registrations:
            basis, is_eligible = self._check_eligibility(program, reg, rule, days_total)
            existing_cert = Certificate.objects.filter(program=program, participant=reg.participant).first()
            eligible_list.append({
                'participant_id': str(reg.participant.id),
                'participant_name': reg.participant.full_name,
                'participant_email': reg.participant.email,
                'registration_number': reg.registration_number,
                'is_eligible': is_eligible,
                'basis': basis,
                'has_certificate': bool(existing_cert),
                'certificate_number': existing_cert.certificate_number if existing_cert else None,
            })

        return Response({'rule': rule, 'total_days': days_total, 'participants': eligible_list})

    def _check_eligibility(self, program, registration, rule, days_total):
        participant = registration.participant
        rule_type = rule.get('type', 'attendance_percentage')

        registered = {
            'participant_id': str(participant.id),
            'registered': True,
            'rule': rule_type,
        }

        if rule_type == 'registration_only':
            return registered, True

        if rule_type == 'attendance_percentage':
            min_pct = rule.get('min_percentage', 75)
            present_count = AttendanceRecord.objects.filter(
                program=program, participant=participant, is_present=True
            ).values('day').distinct().count()
            percentage = (present_count / days_total * 100) if days_total > 0 else 0
            basis = {**registered, 'present_days': present_count, 'total_days': days_total, 'percentage': percentage}
            return basis, percentage >= min_pct

        if rule_type == 'min_days_present':
            min_days = rule.get('min_days', 3)
            present_count = AttendanceRecord.objects.filter(
                program=program, participant=participant, is_present=True
            ).values('day').distinct().count()
            basis = {**registered, 'present_days': present_count, 'min_days': min_days}
            return basis, present_count >= min_days

        if rule_type == 'required_days':
            required_days = set(rule.get('day_numbers', []))
            present_days = set(AttendanceRecord.objects.filter(
                program=program, participant=participant, is_present=True
            ).values_list('day__day_number', flat=True))
            basis = {**registered, 'present_days': sorted(present_days), 'required_days': sorted(required_days)}
            return basis, required_days.issubset(present_days)

        # Default: registration only
        return registered, True


class ProgramCertificateGenerateView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request, program_id):
        program = Program.objects.get(id=program_id)
        config = CertificateConfig.objects.filter(program=program).first()
        if not config:
            return Response({'error': {'code': 'CONFLICT', 'message': 'No certificate config for program'}},
                            status=status.HTTP_409_CONFLICT)

        serializer = CertificateGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Enqueue async job
        from certificates.tasks import generate_certificates_batch
        job = CertificateBatchJob.objects.create(
            program=program, job_type=CertificateBatchJob.JobType.GENERATE,
            parameters={'participant_ids': serializer.validated_data.get('participant_ids', [])},
        )
        try:
            task = generate_certificates_batch.delay(str(job.id))
        except Exception:
            # Broker/worker unavailable -> run inline so the job still completes
            task = None
            generate_certificates_batch(str(job.id))
        if task is not None and getattr(task, 'id', None):
            job.celery_task_id = task.id
            job.save(update_fields=['celery_task_id', 'updated_at'])

        AuditLog.objects.create(
            user=request.user, action='generate_certificates',
            entity_type='Program', entity_id=program.id,
            after={'job_id': str(job.id)}, program_id=program.id
        )
        return Response({'job_id': str(job.id), 'message': 'Certificate generation queued'})


class ProgramCertificateSendView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request, program_id):
        program = Program.objects.get(id=program_id)
        job = CertificateBatchJob.objects.create(
            program=program, job_type=CertificateBatchJob.JobType.SEND,
            parameters=request.data,
        )
        from certificates.tasks import send_certificates_batch
        try:
            task = send_certificates_batch.delay(str(job.id))
        except Exception:
            task = None
            send_certificates_batch(str(job.id))
        if task is not None and getattr(task, 'id', None):
            job.celery_task_id = task.id
            job.save(update_fields=['celery_task_id', 'updated_at'])
        return Response({'job_id': str(job.id), 'message': 'Certificate sending queued'})


from django.db import models