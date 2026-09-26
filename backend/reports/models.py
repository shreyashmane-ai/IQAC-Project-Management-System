"""
Reports models - Configurable column selection, async export
"""
import uuid
from django.db import models
from django.conf import settings
from core.models import AuditableModel, BaseModel
from programs.models import Program, AcademicSession


class ReportType(models.TextChoices):
    REGISTRATION = 'REGISTRATION', 'Registration Report'
    ATTENDANCE = 'ATTENDANCE', 'Attendance Report'
    FOOD = 'FOOD', 'Food Distribution Report'
    FEEDBACK = 'FEEDBACK', 'Feedback Report'
    CERTIFICATE = 'CERTIFICATE', 'Certificate Report'
    PARTICIPANT_STATUS = 'PARTICIPANT_STATUS', 'Participant Status Matrix'
    COMPLETE_PROGRAM = 'COMPLETE_PROGRAM', 'Complete Program Report'
    DEPARTMENT_WISE = 'DEPARTMENT_WISE', 'Department-wise Report'
    ACADEMIC_SESSION = 'ACADEMIC_SESSION', 'Academic Session Analysis'
    CUSTOM = 'CUSTOM', 'Custom Report'


class ReportColumn(AuditableModel):
    """Available columns for each report type"""
    report_type = models.CharField(max_length=30, choices=ReportType.choices, db_index=True)
    field_name = models.CharField(max_length=100)  # Model field or computed property
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    data_type = models.CharField(
        max_length=20,
        choices=[
            ('string', 'String'),
            ('number', 'Number'),
            ('date', 'Date'),
            ('datetime', 'DateTime'),
            ('boolean', 'Boolean'),
            ('json', 'JSON'),
        ],
        default='string'
    )
    is_default = models.BooleanField(default=False)
    is_pii = models.BooleanField(default=False)  # For permission-based hiding
    sort_order = models.IntegerField(default=0)
    depends_on = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configuration dependencies, e.g., {'food_enabled': true} for food columns"
    )
    
    class Meta:
        db_table = 'report_column'
        unique_together = ['report_type', 'field_name']
        ordering = ['report_type', 'sort_order']
    
    def __str__(self):
        return f"{self.get_report_type_display()} - {self.display_name}"


class ReportPreset(AuditableModel):
    """Saved report configurations"""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    report_type = models.CharField(max_length=30, choices=ReportType.choices, db_index=True)
    
    # Configuration
    selected_columns = models.JSONField(default=list)  # List of field_names
    filters = models.JSONField(default=dict, blank=True)
    sorting = models.JSONField(default=list, blank=True)
    
    # Scope
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='report_presets',
        null=True,
        blank=True
    )
    academic_session = models.ForeignKey(
        AcademicSession,
        on_delete=models.CASCADE,
        related_name='report_presets',
        null=True,
        blank=True
    )
    is_global = models.BooleanField(default=False)
    
    # Sharing
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_report_presets'
    )
    is_shared = models.BooleanField(default=False)
    shared_with = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='shared_report_presets',
        blank=True
    )
    
    class Meta:
        db_table = 'report_preset'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.get_report_type_display()})"


class ReportExport(AuditableModel):
    """Async report export job"""
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        QUEUED = 'QUEUED', 'Queued'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
    
    class Format(models.TextChoices):
        XLSX = 'XLSX', 'Excel (.xlsx)'
        CSV = 'CSV', 'CSV'
        PDF = 'PDF', 'PDF'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='report_exports',
        null=True,
        blank=True
    )
    academic_session = models.ForeignKey(
        AcademicSession,
        on_delete=models.CASCADE,
        related_name='report_exports',
        null=True,
        blank=True
    )
    report_type = models.CharField(max_length=30, choices=ReportType.choices, db_index=True)
    
    # Export config
    selected_columns = models.JSONField(default=list)
    filters = models.JSONField(default=dict, blank=True)
    format = models.CharField(max_length=10, choices=Format.choices, default=Format.XLSX)
    
    # Job status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    celery_task_id = models.CharField(max_length=100, blank=True)
    
    # Result
    file = models.FileField(upload_to='reports/exports/', blank=True, null=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'report_export'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['program', 'status']),
            models.Index(fields=['academic_session', 'status']),
        ]
    
    def __str__(self):
        return f"{self.get_report_type_display()} Export - {self.get_status_display()}"