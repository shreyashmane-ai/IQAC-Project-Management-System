"""
Attendance models - Day-wise, idempotent, multi-gate
"""
import uuid
from django.db import models
from django.conf import settings
from core.models import AuditableModel, BaseModel
from programs.models import Program, ProgramDay
from participants.models import Participant, Registration


class AttendanceRecord(AuditableModel):
    """Attendance record for a participant on a specific day"""
    class Source(models.TextChoices):
        SCAN = 'SCAN', 'QR Scan'
        SELF = 'SELF', 'Self Check-in'
        MANUAL = 'MANUAL', 'Manual Entry'
        IMPORT = 'IMPORT', 'Bulk Import'
        CORRECTION = 'CORRECTION', 'Manual Correction'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    day = models.ForeignKey(
        ProgramDay,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    registration = models.ForeignKey(
        Registration,
        on_delete=models.CASCADE,
        related_name='attendance_records',
        null=True,
        blank=True
    )
    
    # Status
    is_present = models.BooleanField(default=True)
    is_late = models.BooleanField(default=False)
    late_threshold_minutes = models.PositiveIntegerField(null=True, blank=True)
    
    # Source & verification
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.SCAN)
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scanned_attendance'
    )
    gate_name = models.CharField(max_length=100, blank=True)
    device_info = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    marked_at = models.DateTimeField(auto_now_add=True, db_index=True)
    program_date = models.DateField(db_index=True)  # Denormalized for queries
    
    # Correction tracking
    is_corrected = models.BooleanField(default=False)
    original_marked_at = models.DateTimeField(null=True, blank=True)
    correction_reason = models.TextField(blank=True)
    corrected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='corrected_attendance'
    )
    corrected_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'attendance_record'
        # CRITICAL: Unique constraint for idempotency - prevents duplicate scans
        constraints = [
            models.UniqueConstraint(
                fields=['participant', 'day'],
                name='unique_participant_day_attendance',
            ),
        ]
        indexes = [
            models.Index(fields=['program', 'day', 'is_present']),
            models.Index(fields=['participant', 'program', 'is_present']),
            models.Index(fields=['scanned_by', 'marked_at']),
            models.Index(fields=['day', 'gate_name']),
            models.Index(fields=['source', 'marked_at']),
        ]
    
    def __str__(self):
        status = "Present" if self.is_present else "Absent"
        late = " (Late)" if self.is_late else ""
        return f"{self.participant.full_name} - {self.day} - {status}{late}"


class AttendanceSession(AuditableModel):
    """Represents an active attendance scanning session for a day"""
    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        ACTIVE = 'ACTIVE', 'Active'
        PAUSED = 'PAUSED', 'Paused'
        CLOSED = 'CLOSED', 'Closed'
    
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='attendance_sessions'
    )
    day = models.OneToOneField(
        ProgramDay,
        on_delete=models.CASCADE,
        related_name='attendance_session'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        db_index=True
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='opened_attendance_sessions'
    )
    opened_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='closed_attendance_sessions'
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    expected_participants = models.PositiveIntegerField(default=0)
    
    class Meta:
        db_table = 'attendance_session'
        indexes = [
            models.Index(fields=['program', 'status']),
            models.Index(fields=['day', 'status']),
        ]
    
    def __str__(self):
        return f"{self.program.short_code} - Day {self.day.day_number} - {self.get_status_display()}"
    
    @property
    def present_count(self):
        return self.attendance_records.filter(is_present=True).count()
    
    @property
    def absent_count(self):
        return self.expected_participants - self.present_count


class AttendanceGate(models.Model):
    """Physical/virtual gate for attendance scanning"""
    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name='gates'
    )
    name = models.CharField(max_length=100)  # e.g., "Main Gate", "Gate 2"
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manned_gates'
    )
    is_active = models.BooleanField(default=True)
    location_info = models.JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'attendance_gate'
        unique_together = ['session', 'name']
    
    def __str__(self):
        return f"{self.session} - {self.name}"