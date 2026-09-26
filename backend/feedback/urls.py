from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
router.register(r'instances', views.FeedbackInstanceViewSet, basename='feedback-instance')
router.register(r'responses', views.FeedbackResponseViewSet, basename='feedback-response')
router.register(r'analytics', views.FeedbackAnalyticsViewSet, basename='feedback-analytics')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program scoped
    path('program/<uuid:program_id>/summary/', views.ProgramFeedbackSummaryView.as_view(), name='program-feedback-summary'),
    path('program/<uuid:program_id>/analytics/', views.ProgramFeedbackAnalyticsView.as_view(), name='program-feedback-analytics'),
]