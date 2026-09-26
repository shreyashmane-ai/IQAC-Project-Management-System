"""
Food app serializers
"""
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import FoodService, FoodEligibility, FoodToken, FoodClaim, FoodSummary


class FoodServiceSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    day_number = serializers.IntegerField(source='day.day_number', read_only=True)
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    eligible_count = serializers.SerializerMethodField()
    sent_count = serializers.SerializerMethodField()
    claimed_count = serializers.SerializerMethodField()

    class Meta:
        model = FoodService
        fields = [
            'id', 'program', 'program_title', 'day', 'day_number',
            'service_type', 'service_type_display', 'name',
            'eligibility_rule', 'service_time',
            'qr_valid_from', 'qr_valid_until',
            'is_active', 'qr_generated', 'qr_generated_at',
            'eligible_count', 'sent_count', 'claimed_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'qr_generated', 'qr_generated_at', 'created_at', 'updated_at']

    @extend_schema_field(serializers.IntegerField)
    def get_eligible_count(self, obj):
        return FoodEligibility.objects.filter(food_service=obj, is_eligible=True).count()

    @extend_schema_field(serializers.IntegerField)
    def get_sent_count(self, obj):
        return FoodEligibility.objects.filter(food_service=obj, is_eligible=True, qr_sent=True).count()

    @extend_schema_field(serializers.IntegerField)
    def get_claimed_count(self, obj):
        from django.db.models import Count
        return FoodToken.objects.filter(food_service=obj, is_claimed=True).count()


class FoodEligibilitySerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    food_service_name = serializers.CharField(source='food_service.service_label', read_only=True)
    qr_token = serializers.SerializerMethodField()

    class Meta:
        model = FoodEligibility
        fields = [
            'id', 'food_service', 'food_service_name',
            'participant', 'participant_name', 'participant_email', 'registration',
            'is_eligible', 'eligibility_basis', 'computed_at',
            'qr_generated', 'qr_generated_at',
            'qr_sent', 'qr_sent_at', 'qr_token',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'computed_at', 'created_at', 'updated_at']

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_qr_token(self, obj):
        if hasattr(obj, 'food_token'):
            return obj.food_token.token
        return None


class FoodTokenSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    food_service_name = serializers.CharField(source='food_service.service_label', read_only=True)
    claimed_by_name = serializers.CharField(source='claimed_by.get_full_name', read_only=True)

    class Meta:
        model = FoodToken
        fields = [
            'id', 'food_service', 'food_service_name', 'participant', 'participant_name',
            'eligibility', 'token', 'is_claimed', 'claimed_at', 'claimed_by', 'claimed_by_name',
            'claim_gate', 'claim_device_info',
            'email_sent', 'email_sent_at', 'email_status', 'email_error',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'token', 'is_claimed', 'claimed_at', 'claimed_by', 'created_at', 'updated_at']


class FoodClaimSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    claimed_by_name = serializers.CharField(source='claimed_by.get_full_name', read_only=True)
    food_service_name = serializers.CharField(source='food_service.service_label', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)

    class Meta:
        model = FoodClaim
        fields = [
            'id', 'token', 'participant', 'participant_name',
            'food_service', 'food_service_name',
            'claimed_at', 'claimed_by', 'claimed_by_name', 'gate_name',
            'device_info', 'result', 'result_display',
        ]
        read_only_fields = fields


class FoodSummarySerializer(serializers.ModelSerializer):
    food_service_name = serializers.CharField(source='food_service.service_label', read_only=True)

    class Meta:
        model = FoodSummary
        fields = [
            'id', 'food_service', 'food_service_name',
            'total_eligible', 'qr_generated_count', 'qr_sent_count',
            'claimed_count', 'last_updated',
        ]
        read_only_fields = fields


class SendNewEligibleSerializer(serializers.Serializer):
    """Response serializer for send-new-eligible"""
    eligible_count = serializers.IntegerField()
    already_sent_count = serializers.IntegerField()
    newly_sent = serializers.IntegerField()
    failed = serializers.IntegerField()


class GenerateQRSerializer(serializers.Serializer):
    """Trigger QR generation for eligible participants"""
    participant_ids = serializers.ListField(child=serializers.UUIDField(), required=False)


class ClaimFoodSerializer(serializers.Serializer):
    token = serializers.CharField()


class PreSendSummarySerializer(serializers.Serializer):
    eligible = serializers.IntegerField()
    already_sent = serializers.IntegerField()
    new_to_send = serializers.IntegerField()