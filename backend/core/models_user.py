"""
Custom User model with roles for IQAC PMS
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from .models import AuditableModel


class Role(models.TextChoices):
    SYSTEM_ADMIN = 'SA', _('System Administrator')
    PROGRAM_ADMIN = 'PA', _('Program Administrator (IQAC Coordinator)')
    PROGRAM_COORDINATOR = 'PC', _('Program Coordinator')
    ATTENDANCE_OPERATOR = 'AO', _('Attendance Operator')
    FOOD_OPERATOR = 'FO', _('Food Counter Operator')
    VIEWER = 'V', _('Viewer / Reporting User')


class User(AbstractUser, AuditableModel):
    """
    Custom user model with role-based access
    """
    email = models.EmailField(_('email address'), unique=True)
    role = models.CharField(
        _('role'),
        max_length=2,
        choices=Role.choices,
        default=Role.VIEWER,
        db_index=True
    )
    phone = models.CharField(_('phone'), max_length=20, blank=True)
    department = models.CharField(_('department'), max_length=100, blank=True)
    designation = models.CharField(_('designation'), max_length=100, blank=True)
    employee_id = models.CharField(_('employee ID'), max_length=50, blank=True, unique=True, null=True)
    is_active = models.BooleanField(_('active'), default=True)
    last_login_ip = models.GenericIPAddressField(_('last login IP'), null=True, blank=True)
    
    # 2FA
    totp_secret = models.CharField(_('TOTP secret'), max_length=32, blank=True)
    totp_enabled = models.BooleanField(_('TOTP enabled'), default=False)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        db_table = 'core_user'
        verbose_name = _('user')
        verbose_name_plural = _('users')
        indexes = [
            models.Index(fields=['role', 'is_active']),
            models.Index(fields=['email', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    @property
    def is_system_admin(self):
        return self.role == Role.SYSTEM_ADMIN
    
    @property
    def is_program_admin(self):
        return self.role in [Role.SYSTEM_ADMIN, Role.PROGRAM_ADMIN]
    
    @property
    def can_manage_programs(self):
        return self.role in [Role.SYSTEM_ADMIN, Role.PROGRAM_ADMIN, Role.PROGRAM_COORDINATOR]
    
    def get_program_scopes(self):
        """Return program IDs this user has access to"""
        if self.is_system_admin or self.role == Role.PROGRAM_ADMIN:
            return None  # All programs
        return self.program_assignments.filter(is_active=True).values_list('program_id', flat=True)


class AuditLog(models.Model):
    """Immutable audit log for all state-changing actions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # Actor
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    user_role = models.CharField(max_length=2, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Action
    action = models.CharField(max_length=50, db_index=True)  # e.g., 'create', 'update', 'delete', 'attendance_mark', 'food_claim'
    entity_type = models.CharField(max_length=50, db_index=True)  # e.g., 'Program', 'Participant', 'AttendanceRecord'
    entity_id = models.UUIDField(db_index=True)
    
    # Changes
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)
    
    # Context
    program_id = models.UUIDField(null=True, blank=True, db_index=True)
    
    class Meta:
        db_table = 'core_audit_log'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['program_id', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action} - {self.entity_type}:{self.entity_id}"