"""
Programs app serializers
"""
from rest_framework import serializers
from django.conf import settings
from django.db import models
from drf_spectacular.utils import extend_schema_field
from .models import (
    AcademicSession,
    Program,
    ProgramDay,
    ProgramServiceConfig,
    AcademicDepartment,
    AdministrativeDepartment,
    Designation,
    ProgramType,
    Venue,
    QuestionType,
    FoodType,
)


def _frontend_link_base(request=None):
    """Absolute base URL for public/participant links served by the React app.

    Prefer the configured frontend/public site URL so links never depend on the
    backend request host (which, behind the Vite proxy, is 127.0.0.1). Falls back
    to the request host when neither setting is configured.
    """
    base = (
        getattr(settings, 'FRONTEND_URL', '')
        or getattr(settings, 'PUBLIC_SITE_URL', '')
    ).rstrip('/')
    if base:
        return base
    if request is not None:
        return request.build_absolute_uri('/').rstrip('/')
    return ''


def _public_link_url(request, token, path):
    if not token:
        return None
    base = _frontend_link_base(request)
    if not base:
        return None
    return f"{base}{path}"


class AcademicSessionSerializer(serializers.ModelSerializer):
    """Academic session serializer"""
    program_count = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = AcademicSession
        fields = [
            'id', 'code', 'name', 'start_date', 'end_date',
            'is_active', 'is_archived', 'description',
            'program_count', 'is_current',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'program_count', 'is_current']

    @extend_schema_field(serializers.IntegerField)
    def get_program_count(self, obj):
        return obj.programs.count()

    @extend_schema_field(serializers.BooleanField)
    def get_is_current(self, obj):
        return obj.is_active

    def validate_code(self, value):
        import re
        if not re.match(r'^\d{4}-\d{2}$', value):
            raise serializers.ValidationError("Code must be in format YYYY-YY (e.g., 2026-27)")
        return value

    def validate(self, attrs):
        start = attrs.get('start_date', self.instance.start_date if self.instance else None)
        end = attrs.get('end_date', self.instance.end_date if self.instance else None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
        return attrs


class AcademicSessionCreateSerializer(serializers.ModelSerializer):
    """Create academic session. Dates default to Apr 1 – Mar 31 derived from the
    code, but may be overridden explicitly via start_date / end_date."""

    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = AcademicSession
        fields = ['code', 'name', 'description', 'start_date', 'end_date']

    def validate_code(self, value):
        # Expect format like "2026-27"
        import re
        if not re.match(r'^\d{4}-\d{2}$', value):
            raise serializers.ValidationError("Code must be in format YYYY-YY (e.g., 2026-27)")
        return value

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
        return attrs

    def create(self, validated_data):
        code = validated_data['code']
        year_start = int(code[:4])

        # Fall back to the derived academic year range when not supplied.
        if validated_data.get('start_date') is None:
            validated_data['start_date'] = f"{year_start}-04-01"
        if validated_data.get('end_date') is None:
            validated_data['end_date'] = f"{year_start + 1}-03-31"

        return super().create(validated_data)


def build_master_serializer(model):
    """Factory: a full ModelSerializer for a per-master table (all fields)."""
    meta = type('Meta', (), {
        'model': model,
        'fields': '__all__',
        'read_only_fields': ['id', 'created_at', 'updated_at'],
    })
    return type(model.__name__ + 'Serializer', (serializers.ModelSerializer,), {'Meta': meta, 'validate': master_validate})


def master_validate(self, attrs):
    code = attrs.get('code')
    if code:
        existing = self.Meta.model.objects.filter(code=code)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError({'code': 'A record with this code already exists.'})
    return attrs


def build_master_item_serializer(model):
    """Factory: compact read-only {id, code, name} used for nested program detail."""
    meta = type('Meta', (), {'model': model, 'fields': ['id', 'code', 'name']})
    return type(model.__name__ + 'ItemSerializer', (serializers.ModelSerializer,), {'Meta': meta})


AcademicDepartmentSerializer = build_master_serializer(AcademicDepartment)
AdministrativeDepartmentSerializer = build_master_serializer(AdministrativeDepartment)
DesignationSerializer = build_master_serializer(Designation)
ProgramTypeSerializer = build_master_serializer(ProgramType)
VenueSerializer = build_master_serializer(Venue)
QuestionTypeSerializer = build_master_serializer(QuestionType)
FoodTypeSerializer = build_master_serializer(FoodType)

AcademicDepartmentItemSerializer = build_master_item_serializer(AcademicDepartment)

class ProgramListSerializer(serializers.ModelSerializer):
    """Lightweight program serializer for lists"""
    academic_session_code = serializers.CharField(source='academic_session.code', read_only=True)
    program_type_name = serializers.CharField(source='program_type.name', read_only=True)
    organizing_departments_detail = AcademicDepartmentItemSerializer(source='organizing_departments', many=True, read_only=True)
    coordinator_name = serializers.CharField(source='program_coordinator.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    registration_count = serializers.SerializerMethodField()
    day_count = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = [
            'id', 'title', 'short_code', 'academic_session', 'academic_session_code',
            'program_type', 'program_type_name',
            'organizing_departments', 'organizing_departments_detail',
            'program_coordinator', 'coordinator_name',
            'start_date', 'end_date', 'number_of_days', 'status', 'status_display',
            'venue', 'venue_details', 'start_time', 'end_time',
            'max_participants', 'registration_count', 'day_count',
            'objective', 'description',
            'public_token', 'registration_link_enabled',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField)
    def get_registration_count(self, obj):
        return obj.registrations.filter(
            status__in=['APPROVED', 'SUBMITTED']
        ).count()

    @extend_schema_field(serializers.IntegerField)
    def get_day_count(self, obj):
        return obj.days.count()


class ProgramDetailSerializer(serializers.ModelSerializer):
    """Full program serializer with nested data"""
    academic_session_code = serializers.CharField(source='academic_session.code', read_only=True)
    academic_session_name = serializers.CharField(source='academic_session.name', read_only=True)
    program_type_name = serializers.CharField(source='program_type.name', read_only=True)
    organizing_departments_detail = AcademicDepartmentItemSerializer(source='organizing_departments', many=True, read_only=True)
    coordinator_name = serializers.CharField(source='program_coordinator.get_full_name', read_only=True)
    coordinator_email = serializers.CharField(source='program_coordinator.email', read_only=True)
    venue_name = serializers.CharField(source='venue.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    collaborating_departments_detail = AcademicDepartmentItemSerializer(source='collaborating_departments', many=True, read_only=True)
    target_departments_detail = AcademicDepartmentItemSerializer(source='target_departments', many=True, read_only=True)
    days = serializers.SerializerMethodField()
    service_configs = serializers.SerializerMethodField()
    registration_count = serializers.SerializerMethodField()
    public_url = serializers.SerializerMethodField()
    registration_url = serializers.SerializerMethodField()
    feedback_url = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = [
            'id', 'title', 'short_code', 'academic_session', 'academic_session_code', 'academic_session_name',
            'program_type', 'program_type_name',
            'organizing_departments', 'organizing_departments_detail',
            'collaborating_departments', 'collaborating_departments_detail',
            'target_departments', 'target_departments_detail',
            'start_date', 'end_date', 'number_of_days', 'venue', 'venue_name', 'venue_details',
            'start_time', 'end_time',
            'program_coordinator', 'coordinator_name', 'coordinator_email',
            'max_participants',
            'objective', 'expected_outcomes', 'description', 'contact_info',
            'status', 'status_display',
            'registration_requires_approval', 'registration_identity_key',
            'registration_schema', 'feedback_schema',
            'certificate_eligibility_rule',
            'public_token', 'public_link_enabled', 'registration_link_enabled', 'feedback_link_enabled',
            'days', 'service_configs', 'registration_count',
            'public_url', 'registration_url', 'feedback_url',
            'created_at', 'updated_at', 'created_by', 'updated_by',
        ]
        read_only_fields = ['id', 'short_code', 'public_token', 'created_at', 'updated_at', 'created_by', 'updated_by']

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_days(self, obj):
        days = obj.days.all().order_by('day_number')
        return ProgramDaySerializer(days, many=True, context=self.context).data

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_service_configs(self, obj):
        configs = obj.service_configs.all()
        return ProgramServiceConfigSerializer(configs, many=True).data

    @extend_schema_field(serializers.IntegerField)
    def get_registration_count(self, obj):
        return obj.registrations.filter(
            status__in=['APPROVED', 'SUBMITTED']
        ).count()

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_public_url(self, obj):
        request = self.context.get('request')
        return _public_link_url(request, obj.public_token, f'/p/{obj.public_token}/')

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_registration_url(self, obj):
        request = self.context.get('request')
        return _public_link_url(request, obj.public_token, f'/p/{obj.public_token}/register/')

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_feedback_url(self, obj):
        request = self.context.get('request')
        return _public_link_url(request, obj.public_token, f'/p/{obj.public_token}/feedback/')


class ProgramCreateSerializer(serializers.ModelSerializer):
    """Create program (step 1 of wizard)"""
    
    class Meta:
        model = Program
        fields = [
            'academic_session', 'title', 'program_type',
            'organizing_departments', 'collaborating_departments', 'target_departments',
            'start_date', 'end_date', 'number_of_days', 'venue', 'venue_details',
            'start_time', 'end_time',
            'program_coordinator',
            'max_participants',
            'objective', 'expected_outcomes', 'description', 'contact_info',
            'registration_requires_approval', 'registration_identity_key',
        ]

    def validate(self, attrs):
        # Validate dates
        if attrs['end_date'] < attrs['start_date']:
            raise serializers.ValidationError("End date must be after start date")
        
        # Validate number of days
        if attrs['number_of_days'] < 1:
            raise serializers.ValidationError("Number of days must be at least 1")
        
        # Validate dates within session
        session = attrs['academic_session']
        if attrs['start_date'] < session.start_date or attrs['end_date'] > session.end_date:
            raise serializers.ValidationError("Program dates must be within academic session")
        
        return attrs

    def create(self, validated_data):
        # Generate short_code from title
        import re
        base_code = re.sub(r'[^A-Z0-9]', '', validated_data['title'].upper())[:8]
        if not base_code:
            base_code = 'PROG'
        
        # Ensure uniqueness
        counter = 1
        short_code = base_code
        while Program.objects.filter(short_code=short_code).exists():
            counter += 1
            short_code = f"{base_code}{counter}"
        
        validated_data['short_code'] = short_code
        validated_data['created_by'] = self.context['request'].user
        
        return super().create(validated_data)


class ProgramUpdateSerializer(serializers.ModelSerializer):
    """Update program (wizard steps)"""
    
    class Meta:
        model = Program
        fields = [
            'academic_session', 'title', 'program_type',
            'organizing_departments', 'collaborating_departments', 'target_departments',
            'start_date', 'end_date', 'number_of_days', 'venue', 'venue_details',
            'start_time', 'end_time',
            'program_coordinator',
            'max_participants',
            'objective', 'expected_outcomes', 'description', 'contact_info',
            'registration_requires_approval', 'registration_identity_key',
            'registration_schema', 'feedback_schema',
            'certificate_eligibility_rule',
            'public_link_enabled', 'registration_link_enabled', 'feedback_link_enabled',
        ]

    def validate(self, attrs):
        # Validate dates if provided
        start_date = attrs.get('start_date', self.instance.start_date)
        end_date = attrs.get('end_date', self.instance.end_date)
        
        if end_date < start_date:
            raise serializers.ValidationError("End date must be after start date")
        
        # Validate number of days
        num_days = attrs.get('number_of_days', self.instance.number_of_days)
        if num_days < 1:
            raise serializers.ValidationError("Number of days must be at least 1")
        
        return attrs


class ProgramStatusSerializer(serializers.Serializer):
    """Program status transition"""
    to = serializers.ChoiceField(choices=Program.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True)


class ProgramWizardStepSerializer(serializers.Serializer):
    """Wizard step validation"""
    step = serializers.IntegerField(min_value=1, max_value=12)
    data = serializers.JSONField()
    validate_only = serializers.BooleanField(default=False)


class ProgramDaySerializer(serializers.ModelSerializer):
    """Program day serializer"""
    service_configs = serializers.SerializerMethodField()
    attendance_enabled = serializers.BooleanField()
    food_enabled = serializers.BooleanField()
    quiz_enabled = serializers.BooleanField()
    other_enabled = serializers.BooleanField()

    class Meta:
        model = ProgramDay
        fields = [
            'id', 'day_number', 'date', 'title', 'start_time', 'end_time',
            'resource_persons', 'is_cancelled', 'cancellation_reason',
            'attendance_enabled', 'food_enabled',
            'quiz_enabled', 'other_enabled', 'other_description',
            'food_type', 'food_eligibility_rule',
            'service_configs',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_service_configs(self, obj):
        configs = obj.service_configs.all()
        return ProgramServiceConfigSerializer(configs, many=True).data


class ProgramDayBulkSerializer(serializers.Serializer):
    """Bulk update program days"""
    days = ProgramDaySerializer(many=True)


class ProgramServiceConfigSerializer(serializers.ModelSerializer):
    """Service config serializer"""
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ProgramServiceConfig
        fields = [
            'id', 'service_type', 'service_type_display', 'is_enabled',
            'config', 'status', 'status_display', 'opens_at', 'closes_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProgramLinkSerializer(serializers.ModelSerializer):
    """Program public link serializer"""
    public_url = serializers.SerializerMethodField()
    registration_url = serializers.SerializerMethodField()
    feedback_url = serializers.SerializerMethodField()
    qr_code = serializers.SerializerMethodField()
    qr_public = serializers.SerializerMethodField()
    qr_registration = serializers.SerializerMethodField()
    qr_feedback = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = [
            'public_token', 'public_link_enabled', 'registration_link_enabled',
            'feedback_link_enabled', 'public_url', 'registration_url',
            'feedback_url', 'qr_code', 'qr_public', 'qr_registration',
            'qr_feedback',
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_public_url(self, obj):
        request = self.context.get('request')
        return _public_link_url(request, obj.public_token, f'/p/{obj.public_token}/')

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_registration_url(self, obj):
        request = self.context.get('request')
        return _public_link_url(request, obj.public_token, f'/p/{obj.public_token}/register/')

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_feedback_url(self, obj):
        request = self.context.get('request')
        return _public_link_url(request, obj.public_token, f'/p/{obj.public_token}/feedback/')

    def _qr_image(self, url):
        # Return base64 QR code image
        if not url:
            return None
        import qrcode
        import io
        import base64

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode()

    def get_qr_code(self, obj):
        return self._qr_image(self.get_public_url(obj))

    def get_qr_public(self, obj):
        return self._qr_image(self.get_public_url(obj))

    def get_qr_registration(self, obj):
        return self._qr_image(self.get_registration_url(obj))

    def get_qr_feedback(self, obj):
        return self._qr_image(self.get_feedback_url(obj))


class ProgramLinkRegenerateSerializer(serializers.Serializer):
    """Regenerate program token"""
    confirm = serializers.BooleanField(default=False)


class ProgramLinkStateSerializer(serializers.Serializer):
    """Update link state"""
    service = serializers.ChoiceField(choices=['public', 'registration', 'feedback'])
    enabled = serializers.BooleanField()


class RegistrationFormSerializer(serializers.Serializer):
    """Registration form schema"""
    schema = serializers.JSONField()
    # Schema format:
    # {
    #   "fields": [
    #     {"name": "field_name", "type": "text|email|number|select|radio|checkbox|date|file",
    #      "label": "Field Label", "required": true, "options": [], "validation": {}}
    #   ]
    # }


class FeedbackFormSerializer(serializers.Serializer):
    """Feedback form schema"""
    schema = serializers.JSONField()


class ProgramDashboardSerializer(serializers.Serializer):
    """Program dashboard stats"""
    registration_count = serializers.IntegerField()
    approved_count = serializers.IntegerField()
    waitlist_count = serializers.IntegerField()
    attendance_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    food_eligible = serializers.IntegerField()
    food_claimed = serializers.IntegerField()
    feedback_count = serializers.IntegerField()
    feedback_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    certificates_issued = serializers.IntegerField()
    certificates_pending = serializers.IntegerField()
    upcoming_days = serializers.ListField()
    recent_activity = serializers.ListField()


class ProgramClosureReadinessSerializer(serializers.Serializer):
    """Program closure readiness check"""
    registration_closed = serializers.BooleanField()
    attendance_finalized = serializers.BooleanField()
    food_finalized = serializers.BooleanField()
    feedback_closed = serializers.BooleanField()
    certificates_handled = serializers.BooleanField()
    documents_uploaded = serializers.BooleanField()
    blockers = serializers.ListField(child=serializers.CharField())
    can_close = serializers.BooleanField()


class FieldTypeSerializer(serializers.Serializer):
    """Field type catalog for form builder"""
    type = serializers.CharField()
    label = serializers.CharField()
    category = serializers.CharField()
    config_schema = serializers.JSONField()
    icon = serializers.CharField(required=False)