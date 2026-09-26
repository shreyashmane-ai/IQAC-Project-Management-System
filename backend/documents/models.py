"""
Documents & Files models - Program supporting documents
"""
import uuid
import os
from django.db import models
from django.conf import settings
from core.models import AuditableModel, BaseModel
from programs.models import Program


def document_upload_path(instance, filename):
    """Generate upload path: documents/program_{id}/{uuid}_{filename}"""
    ext = os.path.splitext(filename)[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    return f"documents/program_{instance.program.id}/{unique_name}"


class DocumentCategory(models.TextChoices):
    CIRCULAR = 'CIRCULAR', 'Circular / Notification'
    POSTER = 'POSTER', 'Poster / Brochure'
    PERMISSION_LETTER = 'PERMISSION_LETTER', 'Permission Letter'
    RESOURCE_PERSON_PROFILE = 'RESOURCE_PERSON_PROFILE', 'Resource Person Profile'
    PRESENTATION = 'PRESENTATION', 'Presentation / Slides'
    ATTENDANCE_EVIDENCE = 'ATTENDANCE_EVIDENCE', 'Attendance Evidence'
    PHOTOGRAPHS = 'PHOTOGRAPHS', 'Photographs'
    FEEDBACK_REPORT = 'FEEDBACK_REPORT', 'Feedback Report'
    PROGRAM_REPORT = 'PROGRAM_REPORT', 'Program Report'
    CERTIFICATE_TEMPLATE = 'CERTIFICATE_TEMPLATE', 'Certificate Template'
    OTHER = 'OTHER', 'Other'


class Document(AuditableModel):
    """Supporting document for a program"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    
    # File
    file = models.FileField(upload_to=document_upload_path)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=100)
    
    # Metadata
    category = models.CharField(
        max_length=30,
        choices=DocumentCategory.choices,
        default=DocumentCategory.OTHER,
        db_index=True
    )
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    
    # Versioning
    version = models.PositiveIntegerField(default=1)
    replaces = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replaced_by'
    )
    
    # Access control
    is_public = models.BooleanField(default=False)
    allowed_roles = models.JSONField(default=list, blank=True)
    
    # Upload info
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents'
    )
    
    # Validation
    is_validated = models.BooleanField(default=False)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_documents'
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    validation_notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'document'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['program', 'category']),
            models.Index(fields=['uploaded_by', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.program.short_code} - {self.title} ({self.get_category_display()})"
    
    def save(self, *args, **kwargs):
        if not self.file_size and self.file:
            self.file_size = self.file.size
        if not self.mime_type and self.file:
            import mimetypes
            self.mime_type = mimetypes.guess_type(self.file.name)[0] or 'application/octet-stream'
        super().save(*args, **kwargs)


class GeneratedArtifact(AuditableModel):
    """System-generated files (certificates, reports, exports)"""
    class ArtifactType(models.TextChoices):
        CERTIFICATE = 'CERTIFICATE', 'Certificate PDF'
        PROGRAM_REPORT = 'PROGRAM_REPORT', 'Program Report'
        EXCEL_EXPORT = 'EXCEL_EXPORT', 'Excel Export'
        QR_CODE = 'QR_CODE', 'QR Code Image'
        FEEDBACK_REPORT = 'FEEDBACK_REPORT', 'Feedback Report'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='generated_artifacts'
    )
    
    artifact_type = models.CharField(max_length=20, choices=ArtifactType.choices, db_index=True)
    related_object_id = models.UUIDField(null=True, blank=True)  # e.g., Certificate ID
    
    file = models.FileField(upload_to='artifacts/%Y/%m/%d/')
    file_size = models.PositiveIntegerField()
    
    # Access
    access_token = models.CharField(max_length=64, unique=True, blank=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    download_count = models.PositiveIntegerField(default=0)
    last_downloaded = models.DateTimeField(null=True, blank=True)
    
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_artifacts'
    )
    
    class Meta:
        db_table = 'generated_artifact'
        indexes = [
            models.Index(fields=['program', 'artifact_type']),
            models.Index(fields=['access_token']),
        ]
    
    def __str__(self):
        return f"{self.program.short_code} - {self.get_artifact_type_display()}"