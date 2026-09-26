from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
router.register(r'records', views.AttendanceRecordViewSet, basename='attendance-record')
router.register(r'sessions', views.AttendanceSessionViewSet, basename='attendance-session')
router.register(r'gates', views.AttendanceGateViewSet, basename='attendance-gate')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program/day scoped
    path('program/<uuid:program_id>/day/<uuid:day_id>/', views.DayAttendanceView.as_view(), name='day-attendance'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/mark/', views.MarkAttendanceView.as_view(), name='mark-attendance'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/roster/', views.AttendanceRosterView.as_view(), name='attendance-roster'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/stats/', views.AttendanceStatsView.as_view(), name='attendance-stats'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/self-qr/', views.DayAttendanceSelfQrView.as_view(), name='attendance-self-qr'),
]