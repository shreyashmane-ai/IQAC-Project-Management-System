"""
Core app views - Authentication
"""
from rest_framework import status, viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
import pyotp
import qrcode
import io
import base64

from .models_user import User, AuditLog, Role
from programs.models import ProgramAssignment
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, TOTPSetupSerializer, TOTPVerifySerializer,
    ProgramAssignmentSerializer, ProgramAssignmentCreateSerializer,
    AuditLogSerializer, RoleSerializer, RoleListSerializer,
)
from .permissions import IsSystemAdmin, IsProgramAdminOrAbove
from core.throttling import AuthLoginThrottle, AuthOtpThrottle, AuthUserThrottle


User = get_user_model()


class LoginView(TokenObtainPairView):
    """Custom login with 2FA support"""
    throttle_classes = [AuthLoginThrottle]
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            user = User.objects.get(email=request.data.get('email'))
            
            # Update last login info
            user.last_login_ip = self.get_client_ip(request)
            user.save(update_fields=['last_login_ip'])
            
            # Check if 2FA is enabled
            if user.totp_enabled:
                return Response({
                    '2fa_required': True,
                    'challenge_id': user.id,
                    'message': '2FA code required'
                }, status=status.HTTP_200_OK)
            
            # Log audit
            AuditLog.objects.create(
                user=user,
                action='login',
                entity_type='User',
                entity_id=user.id,
                after={'email': user.email, 'login_ip': user.last_login_ip}
            )
        
        return response
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class LogoutView(APIView):
    """Logout - blacklist refresh token"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            AuditLog.objects.create(
                user=request.user,
                action='logout',
                entity_type='User',
                entity_id=request.user.id
            )
            return Response({'message': 'Logged out successfully'})
        except Exception:
            return Response({'message': 'Logged out'}, status=status.HTTP_200_OK)


class MeView(APIView):
    """Current user profile with permissions"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        data = serializer.data
        
        # Add effective permissions
        data['permissions'] = self.get_user_permissions(user)
        return Response(data)
    
    def get_user_permissions(self, user):
        """Return effective permissions for UI gating"""
        perms = {
            'can_create_program': user.can_manage_programs,
            'can_manage_users': user.is_system_admin,
            'can_manage_master_data': user.is_program_admin,
            'can_view_audit_log': user.is_program_admin,
            'can_manage_roles': user.is_system_admin,
            'program_scopes': user.get_program_scopes(),
        }
        return perms


class PasswordResetRequestView(APIView):
    """Request password reset"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        # Implementation depends on email backend
        return Response({'message': 'If the email exists, a reset link has been sent'})


class PasswordResetConfirmView(APIView):
    """Confirm password reset"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        # Implementation depends on token validation
        return Response({'message': 'Password reset successful'})


class TOTPSetupView(APIView):
    """Setup 2FA for current user"""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AuthUserThrottle]
    
    def get(self, request):
        user = request.user
        
        # Generate secret if not exists
        if not user.totp_secret:
            user.totp_secret = pyotp.random_base32()
            user.save(update_fields=['totp_secret'])
        
        # Generate provisioning URI
        totp = pyotp.TOTP(user.totp_secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name='IQAC PMS'
        )
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_code_b64 = base64.b64encode(buffer.getvalue()).decode()
        
        serializer = TOTPSetupSerializer({
            'secret': user.totp_secret,
            'qr_code': qr_code_b64,
            'provisioning_uri': provisioning_uri,
        })
        return Response(serializer.data)
    
    def post(self, request):
        """Verify and enable 2FA"""
        serializer = TOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        totp = pyotp.TOTP(user.totp_secret)
        
        if totp.verify(serializer.validated_data['code']):
            user.totp_enabled = True
            user.save(update_fields=['totp_enabled'])
            
            AuditLog.objects.create(
                user=user,
                action='2fa_enable',
                entity_type='User',
                entity_id=user.id
            )
            return Response({'message': '2FA enabled successfully'})
        
        return Response({'error': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)


class TOTPVerifyView(APIView):
    """Verify 2FA code during login"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthOtpThrottle]
    
    def post(self, request):
        serializer = TOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        challenge_id = request.data.get('challenge_id')
        try:
            user = User.objects.get(id=challenge_id)
        except User.DoesNotExist:
            return Response({'error': 'Invalid challenge'}, status=status.HTTP_400_BAD_REQUEST)
        
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(serializer.validated_data['code']):
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            })
        
        return Response({'error': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)


class TOTPDisableView(APIView):
    """Disable 2FA"""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AuthUserThrottle]
    
    def post(self, request):
        user = request.user
        serializer = TOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(serializer.validated_data['code']):
            user.totp_enabled = False
            user.totp_secret = ''
            user.save(update_fields=['totp_enabled', 'totp_secret'])
            
            AuditLog.objects.create(
                user=user,
                action='2fa_disable',
                entity_type='User',
                entity_id=user.id
            )
            return Response({'message': '2FA disabled'})
        
        return Response({'error': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    """User management (SA only)"""
    permission_classes = [IsSystemAdmin]
    queryset = User.objects.all().order_by('date_joined')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        elif self.request.method in ['PATCH', 'PUT']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get('role')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')
        
        if role:
            queryset = queryset.filter(role=role)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if search:
            queryset = queryset.filter(
                models.Q(email__icontains=search) |
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(username__icontains=search)
            )
        return queryset
    
    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            entity_type='User',
            entity_id=user.id,
            after=UserSerializer(user).data
        )
    
    def perform_update(self, serializer):
        old_data = UserSerializer(self.get_object()).data
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            entity_type='User',
            entity_id=user.id,
            before=old_data,
            after=UserSerializer(user).data
        )
    
    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='delete',
            entity_type='User',
            entity_id=instance.id,
            before=UserSerializer(instance).data
        )
        instance.delete()


class RoleViewSet(viewsets.ViewSet):
    """List available roles"""
    permission_classes = [IsSystemAdmin]

    def list(self, request):
        return Response({'roles': [
            {'value': role.value, 'label': role.label}
            for role in Role
        ]})


class ProgramAssignmentViewSet(viewsets.ModelViewSet):
    """Program assignments"""
    permission_classes = [IsSystemAdmin]
    queryset = ProgramAssignment.objects.select_related('user', 'program', 'assigned_by').all()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProgramAssignmentCreateSerializer
        return ProgramAssignmentSerializer
    
    def perform_create(self, serializer):
        assignment = serializer.save(assigned_by=self.request.user)
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            entity_type='ProgramAssignment',
            entity_id=assignment.id,
            after=ProgramAssignmentSerializer(assignment).data
        )


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit log viewer"""
    permission_classes = [IsSystemAdmin | IsProgramAdminOrAbove]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.select_related('user').all()
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by program scope
        user = self.request.user
        if not user.is_program_admin:
            program_ids = user.get_program_scopes()
            if program_ids:
                queryset = queryset.filter(program_id__in=program_ids)
        
        # Filters
        actor = self.request.query_params.get('actor')
        entity_type = self.request.query_params.get('entity_type')
        action = self.request.query_params.get('action')
        program = self.request.query_params.get('program')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if actor:
            queryset = queryset.filter(user_id=actor)
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if action:
            queryset = queryset.filter(action=action)
        if program:
            queryset = queryset.filter(program_id=program)
        if date_from:
            queryset = queryset.filter(timestamp__gte=date_from)
        if date_to:
            queryset = queryset.filter(timestamp__lte=date_to)
        
        return queryset