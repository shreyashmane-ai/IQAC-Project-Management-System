from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
# NOTE: the root '' viewset is registered LAST so its catch-all detail route
# does not shadow the named single-segment prefixes above.
router.register(r'registrations', views.RegistrationViewSet, basename='registration')
router.register(r'waitlist', views.WaitlistPromotionViewSet, basename='waitlist')
router.register(r'', views.ParticipantViewSet, basename='participant')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program-scoped endpoints
    path('program/<uuid:program_id>/', views.ProgramParticipantViewSet.as_view({
        'get': 'list',
    }), name='program-participants'),
    path('program/<uuid:program_id>/<uuid:pk>/', views.ProgramParticipantViewSet.as_view({
        'get': 'retrieve',
    }), name='program-participant-detail'),
    
    # Status matrix
    path('program/<uuid:program_id>/matrix/', views.StatusMatrixView.as_view(), name='status-matrix'),
    path('program/<uuid:program_id>/matrix/export/', views.StatusMatrixExportView.as_view(), name='status-matrix-export'),
    
    # Overrides
    path('<uuid:participant_id>/overrides/', views.ParticipantOverrideView.as_view(), name='participant-overrides'),
]