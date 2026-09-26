"""
Notifications app serializers
"""
from rest_framework import serializers
from .models import (
    NotificationTemplate, NotificationMessage, NotificationBatch, NotificationChannel,
)


class NotificationTemplateSerializer(serializers.ModelSerializer):
    trigger_display = serializers.CharField(source='get_trigger_display', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)

    class Meta:
        model = NotificationTemplate
        fields = [
            'id', 'name', 'trigger', 'trigger_display', 'channel', 'channel_display',
            'subject_template', 'html_template', 'text_template',
            'attach_qr', 'attach_certificate', 'attach_custom',
            'is_active', 'is_system', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system', 'created_at', 'updated_at']

    def validate_trigger(self, value):
        # System triggers are unique; only allow editing non-system templates to change trigger
        if self.instance and self.instance.is_system and self.instance.trigger != value:
            raise serializers.ValidationError('Cannot change trigger of a system template.')
        return value


class NotificationMessageSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    trigger_display = serializers.CharField(source='template.get_trigger_display', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = NotificationMessage
        fields = [
            'id', 'template', 'trigger_display', 'program', 'program_title',
            'participant', 'participant_name', 'participant_email', 'registration',
            'subject', 'html_content', 'text_content', 'attachments',
            'channel', 'channel_display', 'recipient_address', 'provider_message_id',
            'status', 'status_display', 'status_details',
            'idempotency_key', 'retry_count', 'max_retries', 'next_retry_at', 'last_error',
            'sent_at', 'delivered_at', 'opened_at', 'clicked_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'provider_message_id', 'status', 'status_details',
            'sent_at', 'delivered_at', 'opened_at', 'clicked_at',
            'created_at', 'updated_at',
        ]


class NotificationMessageCreateSerializer(serializers.Serializer):
    template_id = serializers.UUIDField()
    program_id = serializers.UUIDField()
    participant_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    recipient_address = serializers.CharField(required=False)
    context_extra = serializers.JSONField(required=False)

    def validate(self, attrs):
        if not attrs.get('participant_ids') and not attrs.get('recipient_address'):
            raise serializers.ValidationError(
                'Either participant_ids or recipient_address is required.'
            )
        return attrs


class NotificationBatchSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    trigger_display = serializers.CharField(source='template.get_trigger_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = NotificationBatch
        fields = [
            'id', 'program', 'program_title', 'template', 'template_name', 'trigger_display',
            'participant_filter', 'registration_filter',
            'total', 'sent', 'failed', 'pending',
            'status', 'status_display', 'celery_task_id',
            'result_summary', 'error_log',
            'started_at', 'completed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'total', 'sent', 'failed', 'pending', 'status',
            'celery_task_id', 'result_summary', 'error_log',
            'started_at', 'completed_at', 'created_at', 'updated_at',
        ]


class SendNotificationBatchSerializer(serializers.Serializer):
    program_id = serializers.UUIDField()
    title = serializers.CharField(required=False)
    body = serializers.CharField(required=False)
    channel = serializers.ChoiceField(choices=NotificationChannel.choices)
    trigger = serializers.ChoiceField(
        choices=NotificationTemplate.Trigger.choices, required=False
    )
    participant_filter = serializers.JSONField(required=False)
    registration_filter = serializers.JSONField(required=False)