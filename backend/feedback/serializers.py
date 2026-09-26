"""
Feedback app serializers
"""
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import FeedbackInstance, FeedbackResponse, FeedbackAnalytics


class FeedbackInstanceSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    day_number = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = FeedbackInstance
        fields = [
            'id', 'program', 'program_title', 'day', 'day_number', 'scope',
            'title', 'description', 'schema', 'schema_version',
            'is_anonymous', 'allow_multiple',
            'status', 'status_display', 'opens_at', 'closes_at',
            'public_token', 'response_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'public_token', 'created_at', 'updated_at']

    @extend_schema_field(serializers.IntegerField)
    def get_response_count(self, obj):
        return obj.responses.count()

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_day_number(self, obj):
        return obj.day.day_number if obj.day else None


class FeedbackInstanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackInstance
        fields = [
            'program', 'day', 'scope', 'title', 'description',
            'schema', 'is_anonymous', 'allow_multiple',
            'opens_at', 'closes_at',
        ]

    def create(self, validated_data):
        import secrets
        validated_data['public_token'] = secrets.token_urlsafe(32)
        return super().create(validated_data)


class FeedbackResponseSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    feedback_title = serializers.CharField(source='feedback_instance.title', read_only=True)

    class Meta:
        model = FeedbackResponse
        fields = [
            'id', 'feedback_instance', 'feedback_title',
            'participant', 'participant_name',
            'answers', 'is_anonymous',
            'submitted_at', 'ip_address', 'completion_time_seconds',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'submitted_at', 'created_at', 'updated_at']


class FeedbackSubmissionSerializer(serializers.Serializer):
    """Public feedback submission"""
    participant_id = serializers.UUIDField()
    answers = serializers.JSONField()
    is_anonymous = serializers.BooleanField(default=False)
    completion_time_seconds = serializers.IntegerField(required=False, min_value=0)


class FeedbackAnalyticsSerializer(serializers.ModelSerializer):
    feedback_title = serializers.CharField(source='feedback_instance.title', read_only=True)

    class Meta:
        model = FeedbackAnalytics
        fields = [
            'id', 'feedback_instance', 'feedback_title',
            'total_responses', 'completion_rate', 'average_rating',
            'question_analytics', 'rating_distribution', 'comments',
            'last_computed',
        ]
        read_only_fields = fields


class FeedbackSummarySerializer(serializers.Serializer):
    response_count = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    average_rating = serializers.FloatField(allow_null=True)
    open_instances = serializers.IntegerField()
    closed_instances = serializers.IntegerField()


class FeedbackAnalyticsDataSerializer(serializers.Serializer):
    total_responses = serializers.IntegerField()
    response_rate = serializers.FloatField()
    per_question = serializers.JSONField()
    rating_distribution = serializers.JSONField()
    satisfaction_percentage = serializers.FloatField(allow_null=True)
    comments = serializers.JSONField()