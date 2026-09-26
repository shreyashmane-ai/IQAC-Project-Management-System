"""
Certificates app serializers
"""
from rest_framework import serializers
from .models import CertificateTemplate, CertificateConfig, Certificate, CertificateBatchJob


class CertificateTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificateTemplate
        fields = [
            'id', 'name', 'description',
            'html_template', 'css_styles', 'page_size', 'orientation',
            'signatory_1_name', 'signatory_1_title', 'signatory_1_signature',
            'signatory_2_name', 'signatory_2_title', 'signatory_2_signature',
            'logo', 'watermark', 'is_default', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CertificateConfigSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)

    class Meta:
        model = CertificateConfig
        fields = [
            'id', 'program', 'program_title', 'template', 'template_name',
            'eligibility_rule',
            'certificate_prefix', 'start_number', 'current_number',
            'auto_generate', 'auto_send', 'require_manual_approval',
            'validity_years', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'current_number', 'created_at', 'updated_at']


class CertificateSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    program_title = serializers.CharField(source='program.title', read_only=True)
    program_short_code = serializers.CharField(source='program.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    verification_url = serializers.CharField(read_only=True)

    class Meta:
        model = Certificate
        fields = [
            'id', 'program', 'program_title', 'program_short_code',
            'participant', 'participant_name', 'participant_email',
            'certificate_number', 'verification_token', 'verification_url',
            'status', 'status_display',
            'eligibility_data',
            'pdf_file', 'pdf_generated_at',
            'email_sent', 'email_sent_at', 'email_status', 'email_error',
            'cancelled_by', 'cancelled_at', 'cancellation_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'certificate_number', 'verification_token', 'verification_url',
            'pdf_file', 'pdf_generated_at',
            'email_sent', 'email_sent_at', 'email_status', 'email_error',
            'created_at', 'updated_at',
        ]


class CertificateEligibleListSerializer(serializers.Serializer):
    participant_id = serializers.UUIDField()
    participant_name = serializers.CharField()
    participant_email = serializers.CharField()
    registration_number = serializers.CharField()
    is_eligible = serializers.BooleanField()
    basis = serializers.JSONField()
    has_certificate = serializers.BooleanField()
    certificate_number = serializers.CharField(allow_null=True)


class CertificateGenerateSerializer(serializers.Serializer):
    participant_ids = serializers.ListField(child=serializers.UUIDField(), required=False)


class CertificateBatchJobSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    job_type_display = serializers.CharField(source='get_job_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = CertificateBatchJob
        fields = [
            'id', 'program', 'program_title', 'job_type', 'job_type_display',
            'status', 'status_display',
            'total', 'processed', 'succeeded', 'failed',
            'parameters', 'result_summary', 'error_log',
            'started_at', 'completed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class CertificateVerifySerializer(serializers.Serializer):
    certificate_number = serializers.CharField()
    status = serializers.ChoiceField(choices=['VALID', 'CANCELLED', 'NOT_FOUND'])
    participant_name = serializers.CharField(required=False)
    program_title = serializers.CharField(required=False)
    program_date = serializers.CharField(required=False)
    issued_by = serializers.CharField(required=False)
    issued_date = serializers.CharField(required=False)