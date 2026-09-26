"""
Programs app - Core domain models for Programs, Days, Services, Forms
"""
import uuid
import secrets
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from core.models import AuditableModel, SoftDeleteModel
from core.models_user import Role


class AcademicSession(AuditableModel, SoftDeleteModel):
    """Academic session (April - March)"""
    code = models.CharField(max_length=20, unique=True, db_index=True)  # e.g., "2026-27"
    name = models.CharField(max_length=100)
    start_date = models.DateField()  # April 1
    end_date = models.DateField()    # March 31
    is_active = models.BooleanField(default=False, db_index=True)
    is_archived = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'programs_academic_session'
        ordering = ['-start_date']
        constraints = [
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='unique_active_session'
            ),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"
    
    def save(self, *args, **kwargs):
        if self.is_active:
            # Deactivate other sessions
            AcademicSession.all_objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        # Never leave an active marker on a soft-deleted row (unique_active_session)
        AcademicSession.all_objects.filter(pk=self.pk).update(is_active=False)
        return super().delete(using=using, keep_parents=keep_parents)


class MasterBase(AuditableModel):
    """Abstract base for all master-data tables (shared columns)."""

    class Meta:
        abstract = True
        ordering = ['sort_order', 'name']

    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.IntegerField(default=0)

    def __str__(self):
        return self.name


class AcademicDepartment(MasterBase):
    """Academic department (feeds Program.organizing/collaborating/target dept & Participant.department)."""
    short_name = models.CharField(max_length=20, blank=True)
    head_of_dept = models.CharField(max_length=200, blank=True)
    hod_email = models.EmailField(blank=True)
    hod_phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)

    class Meta(MasterBase.Meta):
        db_table = 'programs_academic_department'
        unique_together = ['code']


class AdministrativeDepartment(MasterBase):
    """Administrative department."""
    short_name = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    in_charge = models.CharField(max_length=200, blank=True)

    class Meta(MasterBase.Meta):
        db_table = 'programs_admin_department'
        unique_together = ['code']


class Designation(MasterBase):
    """Staff designation (feeds Participant.designation)."""
    STAFF_TEACHING = 'Teaching'
    STAFF_NON_TEACHING = 'Non-Teaching'
    STAFF_TYPE_CHOICES = [
        (STAFF_TEACHING, 'Teaching'),
        (STAFF_NON_TEACHING, 'Non-Teaching'),
    ]

    staff_type = models.CharField(
        max_length=20,
        choices=STAFF_TYPE_CHOICES,
        default=STAFF_TEACHING,
        help_text="Teaching or Non-Teaching (Student is a Non-Teaching designation)",
    )

    class Meta(MasterBase.Meta):
        db_table = 'programs_designation'
        unique_together = ['code']


class ProgramType(MasterBase):
    """Type of program (feeds Program.program_type)."""
    duration_label = models.CharField(max_length=60, blank=True, help_text="e.g. 1 day, 5 days")
    is_credit = models.BooleanField(default=False)
    credit_value = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)

    class Meta(MasterBase.Meta):
        db_table = 'programs_program_type'
        unique_together = ['code']


class Venue(MasterBase):
    """Venue (feeds Program.venue)."""
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    is_online = models.BooleanField(default=False)
    meeting_link = models.CharField(max_length=500, blank=True)

    class Meta(MasterBase.Meta):
        db_table = 'programs_venue'
        unique_together = ['code']


class QuestionType(MasterBase):
    """Question type for the dynamic form engine."""
    render_component = models.CharField(max_length=40, blank=True, help_text="single_choice, multi_choice, text, textarea, rating, scale, date")
    config = models.JSONField(default=dict, blank=True)

    class Meta(MasterBase.Meta):
        db_table = 'programs_question_type'
        unique_together = ['code']


class FoodType(MasterBase):
    """Food / meal type (feeds ProgramDay.food_type)."""
    default_meal = models.CharField(max_length=40, blank=True, help_text="e.g. Breakfast, Lunch, Snacks")

    class Meta(MasterBase.Meta):
        db_table = 'programs_food_type'
        unique_together = ['code']


class Program(AuditableModel, SoftDeleteModel):
    """Main program entity"""
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PUBLISHED = 'PUBLISHED', 'Published'
        REGISTRATION_OPEN = 'REG_OPEN', 'Registration Open'
        REGISTRATION_CLOSED = 'REG_CLOSED', 'Registration Closed'
        ONGOING = 'ONGOING', 'Ongoing'
        COMPLETED = 'COMPLETED', 'Completed'
        ARCHIVED = 'ARCHIVED', 'Archived'
        CANCELLED = 'CANCELLED', 'Cancelled'
        POSTPONED = 'POSTPONED', 'Postponed'
        RESCHEDULED = 'RESCHEDULED', 'Rescheduled'
    
    # Identity
    title = models.CharField(max_length=300)
    short_code = models.CharField(max_length=20, unique=True, db_index=True)  # e.g., "FDP-AI-2026"
    
    # Session & Organization
    academic_session = models.ForeignKey(
        AcademicSession,
        on_delete=models.PROTECT,
        related_name='programs'
    )
    program_type = models.ForeignKey(
        ProgramType,
        on_delete=models.PROTECT,
        related_name='programs_by_type',
    )
    organizing_departments = models.ManyToManyField(
        AcademicDepartment,
        related_name='organized_programs',
        blank=True,
    )
    collaborating_departments = models.ManyToManyField(
        AcademicDepartment,
        related_name='collaborated_programs',
        blank=True
    )
    target_departments = models.ManyToManyField(
        AcademicDepartment,
        related_name='targeted_programs',
        blank=True
    )
    
    # Schedule
    start_date = models.DateField()
    end_date = models.DateField()
    number_of_days = models.PositiveIntegerField(default=1)
    venue = models.ForeignKey(
        Venue,
        on_delete=models.PROTECT,
        related_name='programs_at_venue',
        null=True,
        blank=True
    )
    venue_details = models.TextField(blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # People
    program_coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='coordinated_programs'
    )
    # Capacity & Participants
    max_participants = models.PositiveIntegerField(null=True, blank=True)
    
    # Content
    objective = models.TextField(blank=True)
    expected_outcomes = models.TextField(blank=True)
    description = models.TextField(blank=True)
    contact_info = models.JSONField(default=dict, blank=True)  # phone, email, etc.
    
    # Status & Config
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    registration_requires_approval = models.BooleanField(default=False)
    registration_identity_key = models.JSONField(
        default=list,
        blank=True,
        help_text="Fields that uniquely identify a participant (e.g., ['email'] or ['email', 'mobile'])"
    )
    
    # Dynamic Form Schemas (JSON)
    registration_schema = models.JSONField(default=dict, blank=True)
    feedback_schema = models.JSONField(default=dict, blank=True)
    
    # Certificate Config
    certificate_eligibility_rule = models.JSONField(
        default=dict,
        blank=True,
        help_text="e.g., {'type': 'attendance_percentage', 'value': 75} or {'type': 'days_present', 'min_days': 3}"
    )
    
    # Public Link
    public_token = models.CharField(max_length=64, unique=True, db_index=True, blank=True)
    public_link_enabled = models.BooleanField(default=True)
    registration_link_enabled = models.BooleanField(default=True)
    feedback_link_enabled = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'programs_program'
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['status', 'academic_session']),
            models.Index(fields=['program_coordinator', 'status']),
        ]
    
    def __str__(self):
        return f"{self.short_code} - {self.title}"

    def save(self, *args, **kwargs):
        if not self.public_token:
            self.public_token = secrets.token_urlsafe(32)
        return super().save(*args, **kwargs)


class ProgramDay(AuditableModel):
    """Individual day within a program"""
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='days'
    )
    day_number = models.PositiveIntegerField()  # 1, 2, 3...
    date = models.DateField(db_index=True)
    title = models.CharField(max_length=200, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    # Resource persons for this day (free-text, session-specific; not a shared master list)
    resource_persons = models.JSONField(
        default=list,
        blank=True,
        help_text="List of {name, designation, institution, email, phone} for resource persons on this day"
    )
    is_cancelled = models.BooleanField(default=False)
    cancellation_reason = models.TextField(blank=True)
    
    # Service toggles (per day)
    attendance_enabled = models.BooleanField(default=True)
    food_enabled = models.BooleanField(default=False)
    quiz_enabled = models.BooleanField(default=False)
    other_enabled = models.BooleanField(default=False)
    other_description = models.CharField(max_length=200, blank=True)
    
    # Food config per day
    food_type = models.ForeignKey(
        FoodType,
        on_delete=models.SET_NULL,
        related_name='food_program_days',
        null=True,
        blank=True
    )
    food_eligibility_rule = models.JSONField(
        default=dict,
        blank=True,
        help_text="e.g., {'type': 'attendance_present'} or {'type': 'attendance_percentage', 'value': 50}"
    )
    
    class Meta:
        db_table = 'programs_program_day'
        unique_together = ['program', 'day_number']
        ordering = ['program', 'day_number']
        indexes = [
            models.Index(fields=['program', 'date']),
            models.Index(fields=['date', 'attendance_enabled']),
        ]
    
    def __str__(self):
        return f"{self.program.short_code} - Day {self.day_number} ({self.date})"


class ProgramServiceConfig(AuditableModel):
    """Service-specific configuration per program/day"""
    class ServiceType(models.TextChoices):
        ATTENDANCE = 'ATTENDANCE', 'Attendance'
        FOOD = 'FOOD', 'Food'
        FEEDBACK = 'FEEDBACK', 'Feedback'
        QUIZ = 'QUIZ', 'Quiz'
        OTHER = 'OTHER', 'Other'
    
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='service_configs'
    )
    day = models.ForeignKey(
        ProgramDay,
        on_delete=models.CASCADE,
        related_name='service_configs',
        null=True,
        blank=True
    )
    service_type = models.CharField(max_length=20, choices=ServiceType.choices, db_index=True)
    is_enabled = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)  # Service-specific parameters
    status = models.CharField(
        max_length=20,
        choices=[
            ('SCHEDULED', 'Scheduled'),
            ('ACTIVE', 'Active'),
            ('CLOSED', 'Closed'),
            ('DISABLED', 'Disabled'),
        ],
        default='SCHEDULED',
        db_index=True
    )
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'programs_service_config'
        unique_together = ['program', 'day', 'service_type']
        indexes = [
            models.Index(fields=['program', 'service_type', 'status']),
            models.Index(fields=['day', 'service_type', 'status']),
        ]
    
    def __str__(self):
        day_str = f" Day {self.day.day_number}" if self.day else " (Program-level)"
        return f"{self.program.short_code}{day_str} - {self.get_service_type_display()}"


class ProgramAssignment(models.Model):
    """Links users to programs with specific roles"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='program_assignments'
    )
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    role = models.CharField(
        _('role'),
        max_length=2,
        choices=Role.choices,
        default=Role.PROGRAM_COORDINATOR
    )
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='assigned_program_roles'
    )

    class Meta:
        db_table = 'programs_program_assignment'
        unique_together = ['user', 'program', 'role']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['program', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user} -> {self.program} ({self.get_role_display()})"