"""
Database-agnostic core models for IQAC PMS
Works with both MySQL 8.0+ and PostgreSQL
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.conf import settings


class TimeStampedModel(models.Model):
    """Abstract model with created/updated timestamps"""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Abstract model with UUID primary key"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    class Meta:
        abstract = True


class SoftDeleteManager(models.Manager):
    """Manager that filters out soft-deleted objects"""
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SoftDeleteModel(models.Model):
    """Abstract model with soft delete"""
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    
    objects = SoftDeleteManager()
    all_objects = models.Manager()
    
    class Meta:
        abstract = True
    
    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])
    
    def hard_delete(self):
        super().delete()
    
    def restore(self):
        self.deleted_at = None
        self.save(update_fields=['deleted_at'])


class BaseModel(TimeStampedModel, UUIDModel):
    """Base model with UUID PK and timestamps"""
    class Meta:
        abstract = True


class AuditableModel(BaseModel):
    """Model with audit fields"""
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_created'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_updated'
    )
    
    class Meta:
        abstract = True


# Register user models defined in models_user.py
from core.models_user import User, AuditLog, Role  # noqa: E402,F401