from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views_users


router = DefaultRouter()
# NOTE: the root '' viewset is registered LAST so its catch-all detail route
# does not shadow the named single-segment prefixes above.
router.register(r'roles', views_users.RoleViewSet, basename='role')
router.register(r'assignments', views_users.ProgramAssignmentViewSet, basename='program-assignment')
router.register(r'audit', views_users.AuditLogViewSet, basename='audit-log')
router.register(r'', views_users.UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]
