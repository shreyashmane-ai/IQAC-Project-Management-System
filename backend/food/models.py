"""
Food Management models - Attendance-based eligibility, single-use QR, idempotent operations
"""
import uuid
import secrets
from django.db import models
from django.conf import settings
from core.models import AuditableModel, BaseModel
from programs.models import Program, ProgramDay
from participants.models import Participant, Registration
from attendance.models import AttendanceRecord


class FoodService(AuditableModel):
    """Food service instance for a program day"""
    class ServiceType(models.TextChoices):
        BREAKFAST = 'BREAKFAST', 'Breakfast'
        LUNCH = 'LUNCH', 'Lunch'
        DINNER = 'DINNER', 'Dinner'
        SNACKS = 'SNACKS', 'Snacks/Tea'
        OTHER = 'OTHER', 'Other'
    
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='food_services'
    )
    day = models.ForeignKey(
        ProgramDay,
        on_delete=models.CASCADE,
        related_name='food_services'
    )
    service_type = models.CharField(max_length=20, choices=ServiceType.choices, db_index=True)
    name = models.CharField(max_length=100, blank=True)
    
    # Eligibility rule (default: attendance present that day)
    eligibility_rule = models.JSONField(
        default=dict,
        blank=True,
        help_text="e.g., {'type': 'attendance_present'} or {'type': 'attendance_percentage', 'value': 50, 'reference_day': 1}"
    )
    
    # Timing
    service_time = models.TimeField(null=True, blank=True)
    qr_valid_from = models.DateTimeField(null=True, blank=True)
    qr_valid_until = models.DateTimeField(null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    qr_generated = models.BooleanField(default=False)
    qr_generated_at = models.DateTimeField(null=True, blank=True)
    qr_generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_food_qrs'
    )
    
    class Meta:
        db_table = 'food_service'
        unique_together = ['program', 'day', 'service_type']
        indexes = [
            models.Index(fields=['program', 'day', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.program.short_code} - Day {self.day.day_number} - {self.get_service_type_display()}"

    @property
    def service_label(self):
        return self.name or f"{self.program.short_code} - Day {self.day.day_number} - {self.get_service_type_display()}"


class FoodEligibility(AuditableModel):
    """Computed eligibility for food - separate from attendance"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    food_service = models.ForeignKey(
        FoodService,
        on_delete=models.CASCADE,
        related_name='eligibilities'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='food_eligibilities'
    )
    registration = models.ForeignKey(
        Registration,
        on_delete=models.CASCADE,
        related_name='food_eligibilities',
        null=True,
        blank=True
    )
    
    # Eligibility computation
    is_eligible = models.BooleanField(default=False, db_index=True)
    eligibility_basis = models.JSONField(default=dict, blank=True)  # What made them eligible
    computed_at = models.DateTimeField(auto_now_add=True)
    computed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='computed_food_eligibilities'
    )
    
    # Status flags (SEPARATE - critical for "send only new eligible")
    qr_generated = models.BooleanField(default=False, db_index=True)
    qr_generated_at = models.DateTimeField(null=True, blank=True)
    qr_sent = models.BooleanField(default=False, db_index=True)
    qr_sent_at = models.DateTimeField(null=True, blank=True)
    qr_sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_food_qrs'
    )
    
    class Meta:
        db_table = 'food_eligibility'
        unique_together = ['food_service', 'participant']
        indexes = [
            models.Index(fields=['food_service', 'is_eligible', 'qr_sent']),
            models.Index(fields=['participant', 'is_eligible']),
        ]
    
    def __str__(self):
        status = []
        if self.is_eligible: status.append("Eligible")
        if self.qr_generated: status.append("QR Generated")
        if self.qr_sent: status.append("QR Sent")
        return f"{self.participant.full_name} - {self.food_service} - {', '.join(status)}"


class FoodToken(BaseModel):
    """Unique, single-use food QR token"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    food_service = models.ForeignKey(
        FoodService,
        on_delete=models.CASCADE,
        related_name='tokens'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='food_tokens'
    )
    eligibility = models.OneToOneField(
        FoodEligibility,
        on_delete=models.CASCADE,
        related_name='token'
    )
    
    # Token (opaque, ≥128-bit entropy)
    token = models.CharField(max_length=64, unique=True, db_index=True)
    
    # Status
    is_claimed = models.BooleanField(default=False, db_index=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='claimed_food_tokens'
    )
    claim_gate = models.CharField(max_length=100, blank=True)
    claim_device_info = models.JSONField(default=dict, blank=True)
    
    # Delivery tracking
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    email_status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('SENT', 'Sent'),
            ('FAILED', 'Failed'),
        ],
        default='PENDING'
    )
    email_error = models.TextField(blank=True)
    
    class Meta:
        db_table = 'food_token'
        constraints = [
            models.UniqueConstraint(fields=['eligibility'], name='unique_eligibility_token'),
            models.UniqueConstraint(fields=['token'], name='unique_food_token'),
        ]
        indexes = [
            models.Index(fields=['food_service', 'is_claimed']),
            models.Index(fields=['participant', 'is_claimed']),
            models.Index(fields=['token']),
        ]
    
    def __str__(self):
        status = "Claimed" if self.is_claimed else "Active"
        return f"{self.participant.full_name} - {self.food_service} - {status}"
    
    @classmethod
    def generate_token(cls):
        """Generate secure opaque token"""
        return secrets.token_urlsafe(32)


class FoodClaim(AuditableModel):
    """Food claim record (audit trail)"""
    token = models.ForeignKey(
        FoodToken,
        on_delete=models.CASCADE,
        related_name='claims'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='food_claims'
    )
    food_service = models.ForeignKey(
        FoodService,
        on_delete=models.CASCADE,
        related_name='claims'
    )
    
    # Claim details
    claimed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_food_claims'
    )
    gate_name = models.CharField(max_length=100, blank=True)
    device_info = models.JSONField(default=dict, blank=True)
    
    # Result
    result = models.CharField(
        max_length=20,
        choices=[
            ('SUCCESS', 'Success'),
            ('ALREADY_CLAIMED', 'Already Claimed'),
            ('NOT_ELIGIBLE', 'Not Eligible'),
            ('INVALID_TOKEN', 'Invalid Token'),
            ('WRONG_DAY', 'Wrong Day'),
            ('WRONG_SERVICE', 'Wrong Service'),
            ('EXPIRED', 'Expired'),
        ],
        default='SUCCESS'
    )
    
    class Meta:
        db_table = 'food_claim'
        indexes = [
            models.Index(fields=['food_service', 'claimed_at']),
            models.Index(fields=['participant', 'claimed_at']),
            models.Index(fields=['result', 'claimed_at']),
        ]
    
    def __str__(self):
        return f"{self.participant.full_name} - {self.food_service} - {self.get_result_display()}"


class FoodSummary(AuditableModel):
    """Cached summary for quick dashboard access"""
    food_service = models.OneToOneField(
        FoodService,
        on_delete=models.CASCADE,
        related_name='summary'
    )
    total_eligible = models.PositiveIntegerField(default=0)
    qr_generated_count = models.PositiveIntegerField(default=0)
    qr_sent_count = models.PositiveIntegerField(default=0)
    claimed_count = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'food_summary'
    
    def __str__(self):
        return f"{self.food_service} - Eligible: {self.total_eligible}, Sent: {self.qr_sent_count}, Claimed: {self.claimed_count}"