"""
Invalidate cached public program data when a Program or its days change.

Cached keys:
  public:program:{public_token}
  public:program:{public_token}:days
  public:program:{public_token}:form

The form key lives in participants.views_public but is invalidated here because
it is derived from Program fields (status, registration_link_enabled, schema).
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.core.cache import cache

from .models import Program, ProgramDay


def clear_program_public_cache(public_token):
    if not public_token:
        return
    cache.delete_many([
        f'public:program:{public_token}',
        f'public:program:{public_token}:days',
        f'public:program:{public_token}:form',
    ])


@receiver(post_save, sender=Program)
@receiver(post_delete, sender=Program)
def clear_program_cache(sender, instance, **kwargs):
    clear_program_public_cache(instance.public_token)


@receiver(post_save, sender=ProgramDay)
@receiver(post_delete, sender=ProgramDay)
def clear_program_day_cache(sender, instance, **kwargs):
    # Query by pk so this stays correct even during a cascade delete, when the
    # program row may already be gone from the database.
    public_token = ''
    if instance.program_id:
        public_token = (
            Program.objects.filter(pk=instance.program_id)
            .values_list('public_token', flat=True)
            .first()
            or ''
        )
    clear_program_public_cache(public_token)