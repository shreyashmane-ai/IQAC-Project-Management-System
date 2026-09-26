from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
router.register(r'templates', views.NotificationTemplateViewSet, basename='notification-template')
router.register(r'messages', views.NotificationMessageViewSet, basename='notification-message')
router.register(r'batches', views.NotificationBatchViewSet, basename='notification-batch')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program scoped
    path('program/<uuid:program_id>/send/', views.SendNotificationBatchView.as_view(), name='send-notification-batch'),
]