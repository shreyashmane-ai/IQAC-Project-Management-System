"""
Main URL configuration for IQAC PMS
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core import views_health
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API Schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # API v1
    path('api/v1/health/', views_health.health_check, name='health'),
    path('api/v1/auth/', include('core.urls_auth')),
    path('api/v1/users/', include('core.urls_users')),
    path('api/v1/programs/', include('programs.urls')),
    path('api/v1/participants/', include('participants.urls')),
    path('api/v1/attendance/', include('attendance.urls')),
    path('api/v1/food/', include('food.urls')),
    path('api/v1/feedback/', include('feedback.urls')),
    path('api/v1/certificates/', include('certificates.urls')),
    path('api/v1/reports/', include('reports.urls')),
    path('api/v1/documents/', include('documents.urls')),
    path('api/v1/notifications/', include('notifications.urls')),
    
    # Public API (token-based)
    path('api/v1/public/', include('core.urls_public')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)