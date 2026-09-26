"""
Food app Celery tasks
"""
from celery import shared_task
from django.utils import timezone
from django.db.models import Count


@shared_task
def generate_qr(service_id):
    """Generate QR tokens for a food service (deferred version of synchronous flow)."""
    from .models import FoodService, FoodEligibility, FoodToken
    from participants.models import Registration

    try:
        service = FoodService.objects.get(id=service_id)
    except FoodService.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    registrations = Registration.objects.filter(
        program=service.program, status__in=['APPROVED', 'SUBMITTED']
    )
    generated = 0
    for reg in registrations:
        elig, created = FoodEligibility.objects.get_or_create(
            food_service=service, participant=reg.participant,
            defaults={'registration': reg, 'is_eligible': True},
        )
        if not hasattr(elig, 'food_token'):
            FoodToken.objects.get_or_create(
                food_service=service, participant=reg.participant,
                defaults={'token': FoodToken.generate_token(), 'eligibility': elig},
            )
            generated += 1

    return {'service': str(service.id), 'generated': generated}


@shared_task
def send_qr(eligibility_id):
    """Send QR for a single eligibility."""
    from .models import FoodEligibility

    try:
        elig = FoodEligibility.objects.select_related('participant').get(id=eligibility_id)
    except FoodEligibility.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    if not elig.is_eligible or elig.qr_sent:
        return {'status': 'SKIPPED'}

    from notifications.tasks import send_food_qr_email

    token = elig.food_token if hasattr(elig, 'food_token') else None
    if not token:
        from .models import FoodToken
        token = FoodToken.objects.create(
            food_service=elig.food_service, participant=elig.participant,
            eligibility=elig, token=FoodToken.generate_token(),
        )

    elig.qr_sent = True
    elig.qr_sent_at = timezone.now()
    elig.save(update_fields=['qr_sent', 'qr_sent_at', 'updated_at'])

    token.email_status = 'QUEUED'
    token.save(update_fields=['email_status'])

    send_food_qr_email.delay(str(token.id))
    return {'status': 'QUEUED', 'token': str(token.id)}


@shared_task
def send_food_qr_email(token_id):
    """Enqueue or send food QR email for a token."""
    from .models import FoodToken

    try:
        token = FoodToken.objects.select_related('participant', 'food_service').get(id=token_id)
    except FoodToken.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    # In a real deployment this would use an email provider.
    # Here we mock the provider call.
    try:
        subject = f"Your Food QR - {token.food_service}"
        body = (
            f"Hello {token.participant.full_name},\n\n"
            f"Your food QR token is: {token.token}\n"
            f"Service: {token.food_service.get_service_type_display()}\n"
            f"Program: {token.food_service.program.title}\n"
        )
        # placeholder provider invocation
        token.email_sent = True
        token.email_sent_at = timezone.now()
        token.email_status = 'SENT'
        token.email_error = ''
        token.save(update_fields=['email_sent', 'email_sent_at', 'email_status', 'email_error'])
        return {'status': 'SENT', 'token': token.token}
    except Exception as exc:
        token.email_status = 'FAILED'
        token.email_error = str(exc)[:500]
        token.save(update_fields=['email_status', 'email_error'])
        return {'status': 'FAILED', 'error': str(exc)}


@shared_task
def update_all_summaries():
    """Update cached FoodSummary for all food services."""
    from .models import FoodService, FoodEligibility, FoodToken, FoodSummary

    updated = 0
    for service in FoodService.objects.all():
        total_eligible = FoodEligibility.objects.filter(food_service=service, is_eligible=True).count()
        qr_generated_count = FoodEligibility.objects.filter(food_service=service, qr_generated=True).count()
        qr_sent_count = FoodEligibility.objects.filter(food_service=service, qr_sent=True).count()
        claimed_count = FoodToken.objects.filter(food_service=service, is_claimed=True).count()

        summary, _ = FoodSummary.objects.update_or_create(
            food_service=service,
            defaults={
                'total_eligible': total_eligible,
                'qr_generated_count': qr_generated_count,
                'qr_sent_count': qr_sent_count,
                'claimed_count': claimed_count,
            },
        )
        updated += 1

    return {'updated_summaries': updated}