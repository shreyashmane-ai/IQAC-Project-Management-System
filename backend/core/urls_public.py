from django.urls import path, include
from rest_framework.routers import DefaultRouter
from programs import views_public as program_views
from participants import views_public as participant_views
from feedback import views_public as feedback_views
from attendance import views_public as attendance_views
from food import views_public as food_views
from certificates import views_public as cert_views


urlpatterns = [
    # Program public page
    path('p/<str:token>/', program_views.PublicProgramView.as_view(), name='public-program'),
    path('p/<str:token>/days/', program_views.PublicProgramDaysView.as_view(), name='public-program-days'),
    
    # Registration
    path('p/<str:token>/register/', participant_views.PublicRegistrationView.as_view(), name='public-register'),
    
    # Feedback
    path('p/<str:token>/feedback/', feedback_views.PublicFeedbackView.as_view(), name='public-feedback'),

    # Self-service QR lookup (registration number + email)
    path('my-qrs/', participant_views.PublicQRsView.as_view(), name='public-my-qrs'),
    
    # Attendance scan (operator)
    path('scan/attendance/', attendance_views.AttendanceScanView.as_view(), name='scan-attendance'),
    
    # Self check-in attendance (participant scans QR -> form -> mark present)
    path('p/<str:token>/attendance/', attendance_views.SelfAttendanceView.as_view(), name='public-self-attendance'),
    
    # Food claim scan (operator)
    path('scan/food/', food_views.FoodClaimScanView.as_view(), name='scan-food'),
    
    # Certificate download (participant)
    path('certificates/<str:token>/', cert_views.CertificateDownloadView.as_view(), name='certificate-download'),
    
    # Certificate verification (public)
    path('verify/<str:number>/', cert_views.CertificateVerifyView.as_view(), name='certificate-verify'),
]