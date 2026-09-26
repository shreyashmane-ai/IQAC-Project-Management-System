# Core signals
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from .models_user import User, AuditLog


@receiver(post_save, sender=User)
def log_user_changes(sender, instance, created, **kwargs):
    if created:
        AuditLog.objects.create(
            user=instance,
            action='create',
            entity_type='User',
            entity_id=instance.id,
            after={
                'email': instance.email,
                'role': instance.role,
                'first_name': instance.first_name,
                'last_name': instance.last_name,
            }
        )
    else:
        # Note: For update tracking, use a custom save() method or middleware
        pass