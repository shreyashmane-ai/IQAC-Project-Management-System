"""
Participants app serializers
"""
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Participant, Registration, WaitlistPromotion


class ParticipantSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()
    registration_count = serializers.SerializerMethodField()
    registration_numbers = serializers.SerializerMethodField()

    class Meta:
        model = Participant
        fields = [
            'id', 'email', 'mobile', 'full_name',
            'department', 'department_name', 'designation', 'designation_name',
            'employee_id', 'institution', 'institution_department',
            'institution_designation', 'city', 'state', 'country',
            'extra_data', 'consent_given', 'consent_date',
            'registration_count', 'registration_numbers', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'consent_date', 'created_at', 'updated_at']

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_designation_name(self, obj):
        return obj.designation.name if obj.designation else None

    @extend_schema_field(serializers.IntegerField)
    def get_registration_count(self, obj):
        return obj.registrations.count()

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_registration_numbers(self, obj):
        return list(obj.registrations.order_by('registration_number').values_list('registration_number', flat=True))


class ParticipantDetailSerializer(ParticipantSerializer):
    registrations = serializers.SerializerMethodField()
    attendance_summary = serializers.SerializerMethodField()
    food_summary = serializers.SerializerMethodField()
    feedback_summary = serializers.SerializerMethodField()
    certificate_summary = serializers.SerializerMethodField()

    class Meta(ParticipantSerializer.Meta):
        fields = ParticipantSerializer.Meta.fields + [
            'registrations', 'attendance_summary', 'food_summary',
            'feedback_summary', 'certificate_summary',
        ]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_registrations(self, obj):
        regs = obj.registrations.select_related('program').all()
        return [{
            'id': str(r.id),
            'registration_number': r.registration_number,
            'program_id': str(r.program.id),
            'program_title': r.program.title,
            'program_short_code': r.program.short_code,
            'status': r.status,
        } for r in regs]

    @extend_schema_field(serializers.DictField())
    def get_attendance_summary(self, obj):
        records = obj.attendance_records.all()
        return {
            'total_present': records.filter(is_present=True).count(),
            'total_late': records.filter(is_late=True).count(),
        }

    @extend_schema_field(serializers.DictField())
    def get_food_summary(self, obj):
        from food.models import FoodEligibility
        elig = FoodEligibility.objects.filter(participant=obj)
        return {
            'eligible': elig.filter(is_eligible=True).count(),
            'qr_sent': elig.filter(qr_sent=True).count(),
        }

    @extend_schema_field(serializers.DictField())
    def get_feedback_summary(self, obj):
        from feedback.models import FeedbackResponse
        return {
            'responses_submitted': FeedbackResponse.objects.filter(participant=obj).count(),
        }

    @extend_schema_field(serializers.DictField())
    def get_certificate_summary(self, obj):
        from certificates.models import Certificate
        certs = Certificate.objects.filter(participant=obj)
        return {
            'total': certs.count(),
            'issued': certs.filter(status__in=['GENERATED', 'SENT']).count(),
        }


class RegistrationSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    program_title = serializers.CharField(source='program.title', read_only=True)
    program_short_code = serializers.CharField(source='program.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Registration
        fields = [
            'id', 'program', 'program_title', 'program_short_code',
            'participant', 'participant_name', 'participant_email',
            'registration_number', 'status', 'status_display',
            'form_data', 'identity_key_values',
            'approved_by', 'approved_at', 'rejection_reason',
            'waitlist_position', 'promoted_at',
            'confirmation_sent', 'confirmation_sent_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'registration_number', 'approved_by', 'approved_at',
            'waitlist_position', 'promoted_at',
            'confirmation_sent', 'confirmation_sent_at',
            'created_at', 'updated_at',
        ]


class RegistrationCreateSerializer(serializers.Serializer):
    token = serializers.CharField()
    form_data = serializers.JSONField()

    def validate_token(self, value):
        try:
            program = Program.objects.get(public_token=value, registration_link_enabled=True)
        except Program.DoesNotExist:
            raise serializers.ValidationError("Invalid or disabled registration link")
        if program.status not in [Program.Status.REGISTRATION_OPEN, Program.Status.PUBLISHED]:
            raise serializers.ValidationError("Registration is not open for this program")
        return value


class RegistrationApprovalSerializer(serializers.Serializer):
    registration_ids = serializers.ListField(child=serializers.UUIDField())
    action = serializers.ChoiceField(choices=['approve', 'reject', 'cancel'])
    reason = serializers.CharField(required=False, allow_blank=True)


class WaitlistPromotionSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='registration.participant.full_name', read_only=True)
    registration_number = serializers.CharField(source='registration.registration_number', read_only=True)

    class Meta:
        model = WaitlistPromotion
        fields = [
            'id', 'registration', 'participant_name', 'registration_number',
            'promoted_by', 'promoted_at', 'previous_position', 'reason',
        ]
        read_only_fields = ['id', 'promoted_by', 'promoted_at']


class StatusMatrixSerializer(serializers.Serializer):
    participant_id = serializers.UUIDField()
    participant_name = serializers.CharField()
    participant_email = serializers.CharField()
    department = serializers.CharField(allow_blank=True)
    registration_status = serializers.CharField()
    registration_number = serializers.CharField()
    attendance = serializers.DictField()
    food = serializers.DictField()
    feedback = serializers.DictField()
    certificate = serializers.DictField()


class ParticipantOverrideSerializer(serializers.Serializer):
    override_type = serializers.ChoiceField(choices=['attendance', 'eligibility'])
    day_id = serializers.UUIDField(required=False)
    is_present = serializers.BooleanField(required=False)
    is_eligible = serializers.BooleanField(required=False)
    reason = serializers.CharField()


# Need these imports for RegistrationCreateSerializer validation
from programs.models import Program