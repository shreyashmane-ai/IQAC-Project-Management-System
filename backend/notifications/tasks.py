"""
Notifications app Celery tasks
"""
from django.template import Template, Context
from celery import shared_task
from django.utils import timezone


@shared_task
def send_email(recipient_id, subject, body):
    """Generic email send task (routed to emails queue)."""
    # placeholder provider invocation
    return {'status': 'SENT', 'recipient': recipient_id}


@shared_task
def send_bulk(subject, template_name, recipient_ids):
    """Bulk email send task."""
    return {'status': 'QUEUED', 'recipients': len(recipient_ids)}


@shared_task
def send_notification_message(message_id):
    """Deliver a single notification message."""
    from .models import NotificationMessage

    try:
        message = NotificationMessage.objects.select_related(
            'participant', 'template'
        ).get(id=message_id)
    except NotificationMessage.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    if message.status == NotificationMessage.Status.SENT:
        return {'status': 'ALREADY_SENT'}

    # Idempotency guard
    if message.idempotency_key and NotificationMessage.objects.filter(
        idempotency_key=message.idempotency_key
    ).exclude(id=message.id).filter(status='SENT').exists():
        return {'status': 'DUPLICATE'}

    try:
        # placeholder provider call
        message.status = NotificationMessage.Status.SENT
        message.sent_at = timezone.now()
        message.delivered_at = timezone.now()
        message.last_error = ''
        message.save(update_fields=['status', 'sent_at', 'delivered_at', 'last_error'])
        return {'status': 'SENT', 'message_id': str(message.id)}
    except Exception as exc:
        message.status = NotificationMessage.Status.FAILED
        message.last_error = str(exc)[:500]
        message.retry_count += 1
        message.save(update_fields=['status', 'last_error', 'retry_count'])
        return {'status': 'FAILED', 'error': str(exc)}


@shared_task
def process_batch(batch_id):
    """Create and send notification messages for a batch."""
    from .models import NotificationBatch, NotificationMessage
    from participants.models import Registration

    try:
        batch = NotificationBatch.objects.select_related('program', 'template').get(id=batch_id)
    except NotificationBatch.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    batch.status = NotificationBatch.Status.PROCESSING
    batch.started_at = timezone.now()
    batch.save(update_fields=['status', 'started_at'])

    registrations = Registration.objects.filter(
        program=batch.program, status__in=['APPROVED', 'SUBMITTED']
    )
    reg_filter = batch.registration_filter or {}
    if reg_filter.get('status'):
        registrations = registrations.filter(status=reg_filter['status'])

    sent = failed = 0
    for reg in registrations.select_related('participant'):
        participant = reg.participant
        context = {
            'participant_name': participant.full_name,
            'program_title': batch.program.title,
            'registration_number': reg.registration_number,
        }

        template = batch.template
        if template:
            subject = Template(template.subject_template).render(Context(context))
            html = Template(template.html_template).render(Context(context))
            text = Template(template.text_template or template.subject_template).render(Context(context))
        else:
            subject = f"Notification - {batch.program.short_code}"
            html = subject
            text = subject

        message = NotificationMessage.objects.create(
            template=template,
            program=batch.program,
            participant=participant,
            registration=reg,
            subject=subject,
            html_content=html,
            text_content=text,
            channel=template.channel if template else 'EMAIL',
            recipient_address=participant.email,
            idempotency_key=f"{batch.id}-{participant.id}",
            status='QUEUED',
        )

        result = send_notification_message(str(message.id))
        if result.get('status') == 'SENT':
            sent += 1
        else:
            failed += 1

    batch.sent = sent
    batch.failed = failed
    batch.pending = max(0, batch.total - sent - failed)
    batch.status = NotificationBatch.Status.COMPLETED if failed == 0 else NotificationBatch.Status.PARTIAL
    batch.result_summary = {'sent': sent, 'failed': failed}
    batch.completed_at = timezone.now()
    batch.save(update_fields=[
        'sent', 'failed', 'pending', 'status', 'result_summary', 'completed_at',
    ])
    return {'sent': sent, 'failed': failed}


@shared_task
def process_pending():
    """Process queued notification messages."""
    from .models import NotificationMessage

    queued = NotificationMessage.objects.filter(status='QUEUED')
    count = 0
    for message in queued:
        send_notification_message(str(message.id))
        count += 1
    return {'processed': count}


@shared_task
def retry_failed():
    """Retry failed notification messages."""
    from .models import NotificationMessage

    failed = NotificationMessage.objects.filter(
        status='FAILED', retry_count__lt=3
    )
    count = 0
    for message in failed:
        result = send_notification_message(str(message.id))
        if result.get('status') == 'SENT':
            count += 1
    return {'retried': count}


@shared_task
def send_food_qr_email(token_id):
    """Send food QR email for a token."""
    from food.models import FoodToken

    try:
        token = FoodToken.objects.select_related('participant', 'food_service').get(id=token_id)
    except FoodToken.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    try:
        # placeholder email with QR attachment
        token.email_status = 'SENT'
        token.email_sent = True
        token.email_sent_at = timezone.now()
        token.email_error = ''
        token.save(update_fields=['email_status', 'email_sent', 'email_sent_at', 'email_error'])
        return {'status': 'SENT'}
    except Exception as exc:
        token.email_status = 'FAILED'
        token.email_error = str(exc)[:500]
        token.save(update_fields=['email_status', 'email_error'])
        return {'status': 'FAILED', 'error': str(exc)}


@shared_task
def send_certificate_email(certificate_id):
    """Send certificate PDF email to a participant."""
    from certificates.models import Certificate

    try:
        cert = Certificate.objects.select_related('participant', 'program').get(id=certificate_id)
    except Certificate.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    if cert.email_sent:
        return {'status': 'ALREADY_SENT'}

    try:
        cert.email_sent = True
        cert.email_sent_at = timezone.now()
        cert.email_status = 'SENT'
        cert.email_error = ''
        cert.save(update_fields=['email_sent', 'email_sent_at', 'email_status', 'email_error'])
        return {'status': 'SENT'}
    except Exception as exc:
        cert.email_status = 'FAILED'
        cert.email_error = str(exc)[:500]
        cert.save(update_fields=['email_status', 'email_error'])
        return {'status': 'FAILED', 'error': str(exc)}