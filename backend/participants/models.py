"""
Participants & Registration models
"""
import uuid
import secrets
from django.db import models
from django.conf import settings
from core.models import AuditableModel, SoftDeleteModel, BaseModel
from programs.models import (
    Program,
    ProgramDay,
    AcademicDepartment,
    Designation,
)


class Participant(AuditableModel, SoftDeleteModel):
    """Participant profile (can be linked across programs)"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='participant_profile'
    )
    
    # Identity
    email = models.EmailField(db_index=True)
    mobile = models.CharField(max_length=20, blank=True, db_index=True)
    full_name = models.CharField(max_length=200)
    
    # Internal/External
    # Internal fields
    department = models.ForeignKey(
        AcademicDepartment,
        on_delete=models.SET_NULL,
        related_name='internal_participants',
        null=True,
        blank=True
    )
    designation = models.ForeignKey(
        Designation,
        on_delete=models.SET_NULL,
        related_name='participants_by_designation',
        null=True,
        blank=True
    )
    employee_id = models.CharField(max_length=50, blank=True)
    
    # External fields
    institution = models.CharField(max_length=300, blank=True)
    institution_department = models.CharField(max_length=200, blank=True)
    institution_designation = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True, default='India')
    
    # Additional data
    extra_data = models.JSONField(default=dict, blank=True)
    consent_given = models.BooleanField(default=False)
    consent_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'participants_participant'
        indexes = [
            models.Index(fields=['email', 'mobile']),
        ]
    
    def __str__(self):
        return f"{self.full_name} ({self.email})"


class Registration(AuditableModel):
    """Registration record for a program"""
    class Status(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        WAITLISTED = 'WAITLISTED', 'Waitlisted'
        CANCELLED = 'CANCELLED', 'Cancelled'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='registrations'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='registrations'
    )
    
    # Registration number (human-readable)
    registration_number = models.CharField(max_length=50, unique=True, db_index=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
        db_index=True
    )
    
    # Form data
    form_data = models.JSONField(default=dict)
    form_schema_version = models.JSONField(default=dict, blank=True)  # Snapshot of schema at submission
    
    # Identity key values (for duplicate detection)
    identity_key_values = models.JSONField(default=dict)
    
    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_registrations'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # Waitlist
    waitlist_position = models.PositiveIntegerField(null=True, blank=True)
    promoted_at = models.DateTimeField(null=True, blank=True)
    promoted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='promoted_registrations'
    )
    
    # Tokens
    attendance_token = models.CharField(max_length=64, unique=True, blank=True)
    feedback_token = models.CharField(max_length=64, unique=True, blank=True)
    
    # Communication
    confirmation_sent = models.BooleanField(default=False)
    confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'participants_registration'
        unique_together = [
            ['program', 'participant'],  # One registration per participant per program
        ]
        indexes = [
            models.Index(fields=['program', 'status']),
            models.Index(fields=['participant', 'status']),
            models.Index(fields=['registration_number']),
            # For duplicate detection - partial unique index would be better but not portable
        ]
    
    def __str__(self):
        return f"{self.registration_number} - {self.participant.full_name} ({self.program.short_code})"
    
    def save(self, *args, **kwargs):
        if not self.registration_number:
            self.registration_number = self.generate_registration_number()
        if not self.attendance_token:
            self.attendance_token = secrets.token_urlsafe(32)
        if not self.feedback_token:
            self.feedback_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)
    
    def generate_registration_number(self):
        """Generate human-readable registration number"""
        prefix = self.program.short_code[:8].upper()
        count = Registration.objects.filter(program=self.program).count() + 1
        return f"{prefix}-{count:04d}"
    
    @property
    def is_confirmed(self):
        return self.status in [self.Status.APPROVED, self.Status.SUBMITTED]  # SUBMITTED if auto-approve
    
    @property
    def counts_toward_capacity(self):
        return self.status in [self.Status.APPROVED, self.Status.SUBMITTED]


class WaitlistPromotion(models.Model):
    """Track waitlist promotions"""
    registration = models.ForeignKey(
        Registration,
        on_delete=models.CASCADE,
        related_name='promotions'
    )
    promoted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    promoted_at = models.DateTimeField(auto_now_add=True)
    previous_position = models.PositiveIntegerField()
    reason = models.TextField(blank=True)
    
    class Meta:
        db_table = 'participants_waitlist_promotion'
        ordering = ['-promoted_at']