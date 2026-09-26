"""
Certificate models - Configurable eligibility, verifiable, PDF generation
"""
import uuid
import secrets
from django.db import models
from django.conf import settings
from core.models import AuditableModel, BaseModel
from programs.models import Program
from participants.models import Participant, Registration
from attendance.models import AttendanceRecord


class CertificateTemplate(AuditableModel):
    """Certificate template with placeholders"""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # HTML template with placeholders
    html_template = models.TextField(
        help_text="HTML template with placeholders: {{participant_name}}, {{program_title}}, {{program_dates}}, {{certificate_number}}, {{issue_date}}, {{qr_code}}, {{signatures}}"
    )
    
    # Styling
    css_styles = models.TextField(blank=True)
    page_size = models.CharField(max_length=20, default='A4', choices=[
        ('A4', 'A4'), ('A5', 'A5'), ('LETTER', 'Letter'), ('LEGAL', 'Legal'),
    ])
    orientation = models.CharField(max_length=10, default='portrait', choices=[
        ('portrait', 'Portrait'), ('landscape', 'Landscape'),
    ])
    
    # Signatories
    signatory_1_name = models.CharField(max_length=200, blank=True)
    signatory_1_title = models.CharField(max_length=200, blank=True)
    signatory_1_signature = models.ImageField(upload_to='signatures/', blank=True, null=True)
    signatory_2_name = models.CharField(max_length=200, blank=True)
    signatory_2_title = models.CharField(max_length=200, blank=True)
    signatory_2_signature = models.ImageField(upload_to='signatures/', blank=True, null=True)
    
    # Assets
    logo = models.ImageField(upload_to='certificates/logos/', blank=True, null=True)
    watermark = models.ImageField(upload_to='certificates/watermarks/', blank=True, null=True)
    
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'certificate_template'
        ordering = ['-is_default', 'name']
    
    def __str__(self):
        return self.name


class CertificateConfig(AuditableModel):
    """Per-program certificate configuration"""
    program = models.OneToOneField(
        Program,
        on_delete=models.CASCADE,
        related_name='certificate_config'
    )
    
    template = models.ForeignKey(
        CertificateTemplate,
        on_delete=models.PROTECT,
        related_name='program_configs'
    )
    
    # Eligibility rules
    eligibility_rule = models.JSONField(
        default=dict,
        blank=True,
        help_text="""
        Examples:
        - {'type': 'attendance_percentage', 'min_percentage': 75}
        - {'type': 'min_days_present', 'min_days': 3, 'total_days': 5}
        - {'type': 'required_days', 'day_numbers': [1, 3, 5]}
        - {'type': 'registration_only'}
        - {'type': 'custom', 'expression': 'attendance_rate >= 0.75 AND day_1_present AND day_3_present'}
        """
    )
    
    # Certificate numbering
    certificate_prefix = models.CharField(max_length=20, default='CERT')
    start_number = models.PositiveIntegerField(default=1)
    current_number = models.PositiveIntegerField(default=1)
    
    # Settings
    auto_generate = models.BooleanField(default=False)
    auto_send = models.BooleanField(default=False)
    require_manual_approval = models.BooleanField(default=True)
    
    # Validity
    validity_years = models.PositiveIntegerField(null=True, blank=True)
    
    class Meta:
        db_table = 'certificate_config'
    
    def __str__(self):
        return f"Certificate Config for {self.program.short_code}"


class Certificate(AuditableModel):
    """Issued certificate"""
    class Status(models.TextChoices):
        GENERATED = 'GENERATED', 'Generated'
        SENT = 'SENT', 'Sent'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='certificates'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='certificates'
    )
    registration = models.ForeignKey(
        Registration,
        on_delete=models.CASCADE,
        related_name='certificates',
        null=True,
        blank=True
    )
    config = models.ForeignKey(
        CertificateConfig,
        on_delete=models.PROTECT,
        related_name='certificates'
    )
    
    # Certificate number (unique, human-readable)
    certificate_number = models.CharField(max_length=50, unique=True, db_index=True)
    
    # Verification token (for public verification)
    verification_token = models.CharField(max_length=64, unique=True, db_index=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.GENERATED,
        db_index=True
    )
    
    # Eligibility data (snapshot at generation)
    eligibility_data = models.JSONField(default=dict, blank=True)
    
    # Generated files
    pdf_file = models.FileField(upload_to='certificates/pdfs/', blank=True, null=True)
    pdf_generated_at = models.DateTimeField(null=True, blank=True)
    pdf_generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_certificates'
    )
    
    # Sending
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
    
    # Cancellation
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_certificates'
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    
    class Meta:
        db_table = 'certificate'
        unique_together = ['program', 'participant']
        indexes = [
            models.Index(fields=['program', 'status']),
            models.Index(fields=['participant', 'status']),
            models.Index(fields=['certificate_number']),
            models.Index(fields=['verification_token']),
        ]
    
    def __str__(self):
        return f"{self.certificate_number} - {self.participant.full_name} ({self.program.short_code})"
    
    @property
    def verification_url(self):
        from django.conf import settings
        base = getattr(settings, 'FRONTEND_URL', '').rstrip('/')
        return f"{base}/verify/{self.verification_token}" if base else ''
    
    @property
    def is_valid(self):
        return self.status == self.Status.SENT or self.status == self.Status.GENERATED
    
    @classmethod
    def generate_certificate_number(cls, config):
        """Generate next certificate number"""
        number = config.current_number
        config.current_number = models.F('current_number') + 1
        config.save(update_fields=['current_number'])
        config.refresh_from_db()
        return f"{config.certificate_prefix}-{number:06d}"
    
    @classmethod
    def generate_verification_token(cls):
        return secrets.token_urlsafe(32)


class CertificateBatchJob(AuditableModel):
    """Track bulk certificate generation/sending jobs"""
    class JobType(models.TextChoices):
        GENERATE = 'GENERATE', 'Generate'
        SEND = 'SEND', 'Send'
        REGENERATE = 'REGENERATE', 'Regenerate'
    
    class JobStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        RUNNING = 'RUNNING', 'Running'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        PARTIAL = 'PARTIAL', 'Partial'
    
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='certificate_jobs'
    )
    job_type = models.CharField(max_length=20, choices=JobType.choices)
    status = models.CharField(
        max_length=20,
        choices=JobStatus.choices,
        default=JobStatus.PENDING,
        db_index=True
    )
    celery_task_id = models.CharField(max_length=64, blank=True)
    
    # Progress
    total = models.PositiveIntegerField(default=0)
    processed = models.PositiveIntegerField(default=0)
    succeeded = models.PositiveIntegerField(default=0)
    failed = models.PositiveIntegerField(default=0)
    
    # Details
    parameters = models.JSONField(default=dict, blank=True)
    result_summary = models.JSONField(default=dict, blank=True)
    error_log = models.JSONField(default=list, blank=True)
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'certificate_batch_job'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_job_type_display()} - {self.program.short_code} - {self.get_status_display()}"