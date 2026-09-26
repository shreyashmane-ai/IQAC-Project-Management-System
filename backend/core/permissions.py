"""
Custom permissions for IQAC PMS
"""
from rest_framework import permissions
from .models_user import Role


class IsSystemAdmin(permissions.BasePermission):
    """Only system administrators"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == Role.SYSTEM_ADMIN


class IsProgramAdminOrAbove(permissions.BasePermission):
    """Program admin or system admin"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_program_admin


class IsProgramCoordinatorOrAbove(permissions.BasePermission):
    """Program coordinator, program admin, or system admin"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.can_manage_programs


class HasProgramScope(permissions.BasePermission):
    """
    Check if user has access to the program in the view.

    Fail-closed by default. Views that intentionally allow access without a
    program context (e.g. list endpoints filtered by the caller's assignments)
    must set `allow_without_program_scope = True` on the view class.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # System admin and program admin have access to all programs
        if request.user.is_program_admin:
            return True
        
        # Get program from view kwargs
        program_id = view.kwargs.get('program_id') or view.kwargs.get('pk')
        if not program_id:
            # Fail-closed: require explicit opt-in on the view
            return getattr(view, 'allow_without_program_scope', False)
        
        user_programs = request.user.get_program_scopes()
        # user_programs is None only for system admin / program admin (handled above)
        if user_programs is None:
            return False
        
        return str(program_id) in [str(p) for p in user_programs]
    
    def has_object_permission(self, request, view, obj):
        if request.user.is_program_admin:
            return True
        
        # Check if obj has a program relation
        program = getattr(obj, 'program', None)
        if program is None and hasattr(obj, 'program_id'):
            program = obj.program
        
        if program is None:
            # Fail-closed: require explicit opt-in on the view
            return getattr(view, 'allow_without_program_scope', False)
        
        user_programs = request.user.get_program_scopes()
        if user_programs is None:
            return False
        
        return str(program.id) in [str(p) for p in user_programs]


class IsAttendanceOperator(permissions.BasePermission):
    """Attendance operator or above for assigned programs"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in [
            Role.SYSTEM_ADMIN, Role.PROGRAM_ADMIN, Role.PROGRAM_COORDINATOR, Role.ATTENDANCE_OPERATOR
        ]


class IsFoodOperator(permissions.BasePermission):
    """Food operator or above for assigned programs"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in [
            Role.SYSTEM_ADMIN, Role.PROGRAM_ADMIN, Role.PROGRAM_COORDINATOR, Role.FOOD_OPERATOR
        ]


class ReadOnly(permissions.BasePermission):
    """Read-only access for safe methods"""
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS