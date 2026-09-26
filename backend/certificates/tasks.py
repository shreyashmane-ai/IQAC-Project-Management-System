"""
Certificates app Celery tasks
"""
from celery import shared_task
from django.utils import timezone
from django.db import transaction


@shared_task
def generate_certificate(certificate_id):
    """Generate PDF for a single certificate."""
    from .models import Certificate

    try:
        cert = Certificate.objects.select_related('program', 'participant').get(id=certificate_id)
    except Certificate.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    if cert.pdf_file:
        return {'status': 'ALREADY_GENERATED'}

    try:
        from django.core.files.base import ContentFile
        import io

        pdf_content = io.BytesIO(f"Certificate PDF: {cert.certificate_number}".encode('utf-8'))
        cert.pdf_file.save(
            f"{cert.certificate_number}.pdf",
            ContentFile(pdf_content.getvalue()),
            save=True,
        )
        cert.pdf_generated_at = timezone.now()
        cert.save(update_fields=['pdf_file', 'pdf_generated_at', 'updated_at'])
        return {'status': 'GENERATED', 'certificate_id': str(cert.id)}
    except Exception as exc:
        return {'status': 'FAILED', 'error': str(exc)}


@shared_task
def generate_bulk(program_id, participant_ids=None):
    """Generate certificates for all eligible participants in a program."""
    from .models import Certificate, CertificateConfig
    from participants.models import Registration

    try:
        config = CertificateConfig.objects.select_related('program').get(program_id=program_id)
    except CertificateConfig.DoesNotExist:
        return {'status': 'NO_CONFIG'}

    registrations = Registration.objects.filter(
        program_id=program_id, status__in=['APPROVED', 'SUBMITTED']
    )
    if participant_ids:
        registrations = registrations.filter(participant_id__in=participant_ids)

    generated = failed = 0
    for reg in registrations:
        try:
            cert, created = Certificate.objects.get_or_create(
                program_id=program_id,
                participant=reg.participant,
                defaults={
                    'registration': reg,
                    'config': config,
                    'certificate_number': Certificate.generate_certificate_number(config),
                    'verification_token': Certificate.generate_verification_token(),
                    'eligibility_data': {},
                },
            )
            if created:
                generate_certificate.delay(str(cert.id))
                generated += 1
        except Exception:
            failed += 1

    return {'generated': generated, 'failed': failed}


@shared_task
def send_certificate(certificate_id):
    """Send certificate email for a single certificate."""
    from .models import Certificate

    try:
        cert = Certificate.objects.get(id=certificate_id)
    except Certificate.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    if cert.email_sent:
        return {'status': 'ALREADY_SENT'}

    try:
        cert.email_sent = True
        cert.email_sent_at = timezone.now()
        cert.email_status = 'SENT'
        cert.email_error = ''
        cert.status = Certificate.Status.SENT
        cert.save(update_fields=[
            'email_sent', 'email_sent_at', 'email_status', 'email_error',
            'status', 'updated_at',
        ])
        return {'status': 'SENT'}
    except Exception as exc:
        cert.email_status = 'FAILED'
        cert.email_error = str(exc)[:500]
        cert.save(update_fields=['email_status', 'email_error'])
        return {'status': 'FAILED', 'error': str(exc)}


@shared_task
def generate_certificates_batch(job_id):
    """Process a certificate batch job (generate)."""
    from .models import CertificateBatchJob

    try:
        job = CertificateBatchJob.objects.select_related('program').get(id=job_id)
    except CertificateBatchJob.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    job.status = CertificateBatchJob.JobStatus.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=['status', 'started_at'])

    participant_ids = job.parameters.get('participant_ids', [])
    result = generate_bulk(str(job.program_id), participant_ids)

    job.status = CertificateBatchJob.JobStatus.COMPLETED
    job.succeeded = result.get('generated', 0)
    job.failed = result.get('failed', 0)
    job.processed = job.succeeded + job.failed
    job.total = job.processed
    job.result_summary = result
    job.completed_at = timezone.now()
    job.save(update_fields=[
        'status', 'succeeded', 'failed', 'processed', 'total',
        'result_summary', 'completed_at',
    ])
    return result


@shared_task
def send_certificates_batch(job_id):
    """Process a certificate batch job (send)."""
    from .models import CertificateBatchJob, Certificate

    try:
        job = CertificateBatchJob.objects.select_related('program').get(id=job_id)
    except CertificateBatchJob.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    job.status = CertificateBatchJob.JobStatus.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=['status', 'started_at'])

    certs = Certificate.objects.filter(
        program=job.program, email_sent=False,
        status__in=[Certificate.Status.GENERATED, Certificate.Status.SENT],
    )
    params = job.parameters or {}
    if params.get('participant_ids'):
        certs = certs.filter(participant_id__in=params['participant_ids'])

    sent = 0
    for cert in certs:
        result = send_certificate(str(cert.id))
        if result.get('status') == 'SENT':
            sent += 1

    job.status = CertificateBatchJob.JobStatus.COMPLETED
    job.succeeded = sent
    job.processed = certs.count()
    job.total = certs.count()
    job.result_summary = {'sent': sent}
    job.completed_at = timezone.now()
    job.save(update_fields=[
        'status', 'succeeded', 'processed', 'total', 'result_summary', 'completed_at',
    ])
    return {'sent': sent}