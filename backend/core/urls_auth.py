from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from . import views_auth


urlpatterns = [
    path('login/', views_auth.LoginView.as_view(), name='login'),
    path('logout/', views_auth.LogoutView.as_view(), name='logout'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('me/', views_auth.MeView.as_view(), name='me'),
    path('password/reset/', views_auth.PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password/reset/confirm/', views_auth.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('2fa/setup/', views_auth.TOTPSetupView.as_view(), name='2fa_setup'),
    path('2fa/verify/', views_auth.TOTPVerifyView.as_view(), name='2fa_verify'),
    path('2fa/disable/', views_auth.TOTPDisableView.as_view(), name='2fa_disable'),
]