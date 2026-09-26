"""
Reports app serializers
"""
from rest_framework import serializers
from .models import ReportColumn, ReportPreset, ReportExport, ReportType


class ReportColumnSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)

    class Meta:
        model = ReportColumn
        fields = [
            'id', 'report_type', 'report_type_display', 'field_name', 'display_name',
            'description', 'data_type', 'is_default', 'is_pii', 'sort_order',
            'depends_on',
        ]
        read_only_fields = ['id']


class ReportColumnCatalogSerializer(serializers.Serializer):
    report_type = serializers.CharField()
    columns = ReportColumnSerializer(many=True)


class ReportPresetSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    program_title = serializers.CharField(source='program.title', read_only=True)

    class Meta:
        model = ReportPreset
        fields = [
            'id', 'name', 'description', 'report_type', 'report_type_display',
            'selected_columns', 'filters', 'sorting',
            'program', 'program_title', 'academic_session',
            'is_global', 'created_by', 'created_by_name',
            'is_shared', 'shared_with',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class ReportPresetCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportPreset
        fields = [
            'name', 'description', 'report_type',
            'selected_columns', 'filters', 'sorting',
            'program', 'academic_session', 'is_global', 'is_shared', 'shared_with',
        ]


class ReportExportSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    program_title = serializers.CharField(source='program.title', read_only=True)

    class Meta:
        model = ReportExport
        fields = [
            'id', 'program', 'program_title', 'academic_session',
            'report_type', 'report_type_display',
            'selected_columns', 'filters', 'format',
            'status', 'status_display', 'file', 'file_size',
            'row_count', 'error_message',
            'started_at', 'completed_at', 'expires_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'file', 'file_size', 'row_count', 'error_message',
            'started_at', 'completed_at', 'expires_at', 'created_at', 'updated_at',
        ]


class GenerateReportExportSerializer(serializers.Serializer):
    report_type = serializers.ChoiceField(choices=ReportType.choices)
    program_id = serializers.UUIDField(required=False)
    session_id = serializers.UUIDField(required=False)
    selected_columns = serializers.ListField(child=serializers.CharField(), required=False)
    filters = serializers.JSONField(required=False)
    format = serializers.ChoiceField(choices=['XLSX', 'CSV', 'PDF'], default='XLSX')


class ReportExportStatusSerializer(serializers.Serializer):
    job_id = serializers.UUIDField()
    status = serializers.CharField()
    progress = serializers.IntegerField()
    file_url = serializers.CharField(required=False)
    row_count = serializers.IntegerField(required=False)
    error_message = serializers.CharField(required=False)