"""
Attendance app serializers
"""
from rest_framework import serializers
from .models import AttendanceRecord, AttendanceSession, AttendanceGate


class AttendanceRecordSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    program_title = serializers.CharField(source='program.title', read_only=True)
    day_number = serializers.IntegerField(source='day.day_number', read_only=True)
    day_date = serializers.DateField(source='day.date', read_only=True)
    scanned_by_name = serializers.CharField(source='scanned_by.get_full_name', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'program', 'program_title', 'day', 'day_number', 'day_date',
            'participant', 'participant_name', 'participant_email', 'registration',
            'is_present', 'is_late', 'late_threshold_minutes',
            'source', 'source_display', 'scanned_by', 'scanned_by_name',
            'gate_name', 'marked_at', 'program_date',
            'is_corrected', 'correction_reason', 'corrected_by', 'corrected_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'marked_at', 'created_at', 'updated_at']


class MarkAttendanceSerializer(serializers.Serializer):
    """Mark attendance by scan token or participant reference"""
    token = serializers.CharField(required=False, allow_blank=True)
    participant_id = serializers.UUIDField(required=False)
    registration_number = serializers.CharField(required=False, allow_blank=True)
    gate_name = serializers.CharField(required=False, default='')
    is_late = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if not attrs.get('token') and not attrs.get('participant_id') and not attrs.get('registration_number'):
            raise serializers.ValidationError("Provide a token, participant_id, or registration_number")
        return attrs


class AttendanceSessionSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    day_number = serializers.IntegerField(source='day.day_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    present_count = serializers.IntegerField(read_only=True)
    absent_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'program', 'program_title', 'day', 'day_number',
            'status', 'status_display', 'opened_by', 'opened_at',
            'closed_by', 'closed_at', 'expected_participants',
            'present_count', 'absent_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'opened_by', 'opened_at', 'closed_by', 'closed_at', 'created_at', 'updated_at']


class AttendanceGateSerializer(serializers.ModelSerializer):
    session_title = serializers.CharField(source='session.__str__', read_only=True)
    operator_name = serializers.CharField(source='operator.get_full_name', read_only=True)

    class Meta:
        model = AttendanceGate
        fields = [
            'id', 'session', 'session_title', 'name', 'operator', 'operator_name',
            'is_active', 'location_info',
        ]
        read_only_fields = ['id']


class AttendanceStatsSerializer(serializers.Serializer):
    total_expected = serializers.IntegerField()
    present = serializers.IntegerField()
    absent = serializers.IntegerField()
    late = serializers.IntegerField()
    attendance_rate = serializers.FloatField()


class AttendanceRosterSerializer(serializers.Serializer):
    participant_id = serializers.UUIDField()
    participant_name = serializers.CharField()
    participant_email = serializers.CharField()
    registration_number = serializers.CharField()
    is_present = serializers.BooleanField()
    is_late = serializers.BooleanField()
    marked_at = serializers.DateTimeField(allow_null=True)
    scanned_by = serializers.CharField(allow_blank=True)


class SelfQrResponseSerializer(serializers.Serializer):
    program_id = serializers.UUIDField()
    program_title = serializers.CharField()
    short_code = serializers.CharField()
    day_id = serializers.UUIDField()
    day_number = serializers.IntegerField()
    day_date = serializers.DateField()
    attendance_enabled = serializers.BooleanField()
    url = serializers.URLField(allow_blank=True)
    qr = serializers.CharField()