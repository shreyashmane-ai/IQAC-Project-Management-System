"""
Core app serializers
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from drf_spectacular.utils import extend_schema_field
from .models_user import User, AuditLog, Role
from programs.models import ProgramAssignment


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """User serializer with role display"""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    full_name = serializers.SerializerMethodField()
    program_scopes = serializers.SerializerMethodField()
    can_manage_programs = serializers.BooleanField(read_only=True)
    is_program_admin = serializers.BooleanField(read_only=True)
    is_system_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'role_display', 'phone', 'department', 'designation',
            'employee_id', 'is_active', 'last_login', 'last_login_ip',
            'totp_enabled', 'created_at', 'updated_at',
            'program_scopes', 'can_manage_programs', 'is_program_admin', 'is_system_admin',
        ]
        read_only_fields = ['id', 'last_login', 'last_login_ip', 'totp_enabled', 'created_at', 'updated_at']

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_program_scopes(self, obj):
        scopes = obj.get_program_scopes()
        return list(scopes) if scopes is not None else None

    @extend_schema_field(serializers.CharField)
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users"""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'phone', 'department',
            'designation', 'employee_id',
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match"})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users"""

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'role', 'phone', 'department',
            'designation', 'employee_id', 'is_active',
        ]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match"})
        return attrs


class TOTPSetupSerializer(serializers.Serializer):
    """TOTP setup response"""
    secret = serializers.CharField()
    qr_code = serializers.CharField()  # Base64 encoded QR code image
    provisioning_uri = serializers.CharField()


class TOTPVerifySerializer(serializers.Serializer):
    """TOTP verification"""
    code = serializers.CharField(max_length=6, min_length=6)


class ProgramAssignmentSerializer(serializers.ModelSerializer):
    """Program assignment serializer"""
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    program_title = serializers.CharField(source='program.title', read_only=True)
    program_short_code = serializers.CharField(source='program.short_code', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.get_full_name', read_only=True)

    class Meta:
        model = ProgramAssignment
        fields = [
            'id', 'user', 'user_email', 'user_name', 'program', 'program_title',
            'program_short_code', 'role', 'role_display', 'is_active',
            'assigned_at', 'assigned_by', 'assigned_by_name',
        ]
        read_only_fields = ['id', 'assigned_at', 'assigned_by']


class ProgramAssignmentCreateSerializer(serializers.ModelSerializer):
    """Create program assignment"""

    class Meta:
        model = ProgramAssignment
        fields = ['user', 'program', 'role']

    def validate(self, attrs):
        # Check if assignment already exists
        if ProgramAssignment.objects.filter(
            user=attrs['user'],
            program=attrs['program'],
            role=attrs['role']
        ).exists():
            raise serializers.ValidationError("Assignment already exists")
        return attrs


class AuditLogSerializer(serializers.ModelSerializer):
    """Audit log serializer"""
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'timestamp', 'user', 'user_email', 'user_name', 'user_role',
            'ip_address', 'action', 'entity_type', 'entity_id',
            'before', 'after', 'reason', 'program_id',
        ]
        read_only_fields = fields


class RoleSerializer(serializers.Serializer):
    """Role choices serializer"""
    value = serializers.CharField()
    label = serializers.CharField()


class RoleListSerializer(serializers.Serializer):
    """List of roles"""
    roles = RoleSerializer(many=True)