"""
Feedback models - Program-level or day-wise, dynamic forms
"""
import uuid
from django.db import models
from django.conf import settings
from core.models import AuditableModel, BaseModel
from programs.models import Program, ProgramDay
from participants.models import Participant, Registration


class FeedbackInstance(AuditableModel):
    """Feedback form instance - program-level or per-day"""
    class Scope(models.TextChoices):
        PROGRAM = 'PROGRAM', 'Program Level'
        DAY = 'DAY', 'Day Level'
    
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='feedback_instances'
    )
    day = models.ForeignKey(
        ProgramDay,
        on_delete=models.CASCADE,
        related_name='feedback_instances',
        null=True,
        blank=True
    )
    scope = models.CharField(max_length=10, choices=Scope.choices, default=Scope.PROGRAM)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Form schema (dynamic)
    schema = models.JSONField(default=dict, blank=True)
    schema_version = models.JSONField(default=dict, blank=True)
    
    # Settings
    is_anonymous = models.BooleanField(default=False)
    allow_multiple = models.BooleanField(default=False)
    
    # Status & timing
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
    
    # Link
    public_token = models.CharField(max_length=64, unique=True, blank=True, db_index=True)
    
    class Meta:
        db_table = 'feedback_instance'
        unique_together = ['program', 'day', 'scope']
        indexes = [
            models.Index(fields=['program', 'status']),
            models.Index(fields=['public_token']),
        ]
    
    def __str__(self):
        scope_str = f"Day {self.day.day_number}" if self.day else "Program"
        return f"{self.program.short_code} - {scope_str} Feedback"


class FeedbackResponse(AuditableModel):
    """Participant feedback response"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feedback_instance = models.ForeignKey(
        FeedbackInstance,
        on_delete=models.CASCADE,
        related_name='responses'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='feedback_responses'
    )
    registration = models.ForeignKey(
        Registration,
        on_delete=models.CASCADE,
        related_name='feedback_responses',
        null=True,
        blank=True
    )
    
    # Response data
    answers = models.JSONField(default=dict)
    is_anonymous = models.BooleanField(default=False)
    
    # Metadata
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    completion_time_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    class Meta:
        db_table = 'feedback_response'
        # Prevent duplicate feedback per participant per instance (unless anonymous+multiple allowed)
        unique_together = ['feedback_instance', 'participant']
        indexes = [
            models.Index(fields=['feedback_instance', 'submitted_at']),
            models.Index(fields=['participant', 'submitted_at']),
        ]
    
    def __str__(self):
        anon = " (Anonymous)" if self.is_anonymous else ""
        return f"{self.participant.full_name}{anon} - {self.feedback_instance}"


class FeedbackAnalytics(AuditableModel):
    """Cached analytics for feedback instance"""
    feedback_instance = models.OneToOneField(
        FeedbackInstance,
        on_delete=models.CASCADE,
        related_name='analytics'
    )
    
    # Aggregated stats
    total_responses = models.PositiveIntegerField(default=0)
    completion_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    
    # Question-wise analytics (JSON)
    question_analytics = models.JSONField(default=dict, blank=True)
    rating_distribution = models.JSONField(default=dict, blank=True)
    comments = models.JSONField(default=list, blank=True)  # Free-text responses
    
    # Computed
    last_computed = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'feedback_analytics'
    
    def __str__(self):
        return f"Analytics for {self.feedback_instance}"