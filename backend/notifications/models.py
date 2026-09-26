"""
Notifications models - Templates, delivery tracking, idempotent sending
"""
import uuid
from django.db import models
from django.conf import settings
from core.models import AuditableModel, BaseModel
from programs.models import Program
from participants.models import Participant, Registration


class NotificationChannel(models.TextChoices):
    EMAIL = 'EMAIL', 'Email'
    SMS = 'SMS', 'SMS'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    PUSH = 'PUSH', 'Push Notification'


class NotificationTemplate(AuditableModel):
    """Reusable notification templates"""
    class Trigger(models.TextChoices):
        REGISTRATION_CONFIRMATION = 'REG_CONFIRM', 'Registration Confirmation'
        REGISTRATION_APPROVAL = 'REG_APPROVAL', 'Registration Approval'
        REGISTRATION_REJECTION = 'REG_REJECTION', 'Registration Rejection'
        PROGRAM_REMINDER = 'PROGRAM_REMINDER', 'Program Reminder'
        FOOD_QR = 'FOOD_QR', 'Food QR Code'
        FEEDBACK_INVITATION = 'FEEDBACK_INVITE', 'Feedback Invitation'
        CERTIFICATE = 'CERTIFICATE', 'Certificate Issued'
        PROGRAM_CANCELLATION = 'PROGRAM_CANCEL', 'Program Cancellation'
        PROGRAM_RESCHEDULE = 'PROGRAM_RESCHEDULE', 'Program Reschedule'
        WAITLIST_PROMOTION = 'WAITLIST_PROMO', 'Waitlist Promotion'
        ATTENDANCE_MARKED = 'ATTENDANCE_MARKED', 'Attendance Marked'
    
    name = models.CharField(max_length=100)
    trigger = models.CharField(max_length=30, choices=Trigger.choices, unique=True, db_index=True)
    channel = models.CharField(max_length=10, choices=NotificationChannel.choices, default=NotificationChannel.EMAIL)
    
    # Template content (Jinja2/MJML for email)
    subject_template = models.CharField(max_length=200)
    html_template = models.TextField(
        help_text="MJML or HTML template with placeholders: {{participant_name}}, {{program_title}}, {{registration_number}}, {{qr_code}}, {{certificate_number}}, {{verification_url}}, etc."
    )
    text_template = models.TextField(blank=True, help_text="Plain text fallback")
    
    # Attachments
    attach_qr = models.BooleanField(default=False)
    attach_certificate = models.BooleanField(default=False)
    attach_custom = models.JSONField(default=list, blank=True)
    
    # Settings
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)  # System templates can't be deleted
    
    class Meta:
        db_table = 'notification_template'
        ordering = ['trigger']
    
    def __str__(self):
        return f"{self.get_trigger_display()} ({self.get_channel_display()})"


class NotificationMessage(AuditableModel):
    """Individual notification message with delivery tracking"""
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        QUEUED = 'QUEUED', 'Queued'
        SENDING = 'SENDING', 'Sending'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'
        BOUNCED = 'BOUNCED', 'Bounced'
        DELIVERED = 'DELIVERED', 'Delivered'
        OPENED = 'OPENED', 'Opened'
        CLICKED = 'CLICKED', 'Clicked'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.PROTECT,
        related_name='messages'
    )
    
    # Recipient
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='notification_messages'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='notification_messages'
    )
    registration = models.ForeignKey(
        Registration,
        on_delete=models.CASCADE,
        related_name='notification_messages',
        null=True,
        blank=True
    )
    
    # Rendered content
    subject = models.CharField(max_length=300)
    html_content = models.TextField()
    text_content = models.TextField(blank=True)
    attachments = models.JSONField(default=list, blank=True)
    
    # Delivery
    channel = models.CharField(max_length=10, choices=NotificationChannel.choices)
    recipient_address = models.CharField(max_length=300)  # email, phone, etc.
    provider_message_id = models.CharField(max_length=200, blank=True)
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    status_details = models.JSONField(default=dict, blank=True)
    
    # Idempotency
    idempotency_key = models.CharField(max_length=100, unique=True, blank=True, db_index=True)
    
    # Retry
    retry_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=3)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    
    # Timing
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'notification_message'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['program', 'status']),
            models.Index(fields=['participant', 'status']),
            models.Index(fields=['template', 'status']),
            models.Index(fields=['idempotency_key']),
            models.Index(fields=['status', 'next_retry_at']),
        ]
    
    def __str__(self):
        return f"{self.template.get_trigger_display()} to {self.participant.full_name} - {self.get_status_display()}"


class NotificationBatch(AuditableModel):
    """Bulk notification sending job"""
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        QUEUED = 'QUEUED', 'Queued'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        PARTIAL = 'PARTIAL', 'Partial'
    
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='notification_batches'
    )
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.PROTECT,
        related_name='batches'
    )
    
    # Targeting
    participant_filter = models.JSONField(default=dict, blank=True)
    registration_filter = models.JSONField(default=dict, blank=True)
    
    # Progress
    total = models.PositiveIntegerField(default=0)
    sent = models.PositiveIntegerField(default=0)
    failed = models.PositiveIntegerField(default=0)
    pending = models.PositiveIntegerField(default=0)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    celery_task_id = models.CharField(max_length=100, blank=True)
    
    # Result
    result_summary = models.JSONField(default=dict, blank=True)
    error_log = models.JSONField(default=list, blank=True)
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'notification_batch'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Batch: {self.template.get_trigger_display()} - {self.program.short_code} - {self.get_status_display()}"