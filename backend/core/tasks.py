"""
Core app Celery tasks
"""
from celery import shared_task
from django.utils import timezone


@shared_task
def cleanup_expired_tokens():
    """
    Log/cleanup expired public tokens and stale data.
    Idempotent - safe to run repeatedly.
    """
    # FoodQR expiry marks unclaimed tokens as expired
    from food.models import FoodService, FoodToken
    expired_services = FoodService.objects.filter(
        is_active=True,
        qr_valid_until__lt=timezone.now(),
    )
    expired_count = FoodToken.objects.filter(
        food_service__in=expired_services,
        is_claimed=False,
    ).update(is_claimed=True, claimed_at=timezone.now())

    # Close auto-closing feedback instances
    from feedback.models import FeedbackInstance
    closed_count = FeedbackInstance.objects.filter(
        status='ACTIVE',
        closes_at__lt=timezone.now(),
    ).update(status='CLOSED')

    return {
        'expired_food_tokens': expired_count,
        'auto_closed_feedback': closed_count,
    }