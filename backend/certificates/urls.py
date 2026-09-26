from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
router.register(r'templates', views.CertificateTemplateViewSet, basename='certificate-template')
router.register(r'configs', views.CertificateConfigViewSet, basename='certificate-config')
router.register(r'jobs', views.CertificateBatchJobViewSet, basename='certificate-job')
# NOTE: the root '' viewset is registered LAST so its catch-all detail route
# does not shadow the named single-segment prefixes above.
router.register(r'', views.CertificateViewSet, basename='certificate')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program scoped
    path('program/<uuid:program_id>/config/', views.ProgramCertificateConfigView.as_view(), name='program-certificate-config'),
    path('program/<uuid:program_id>/eligible/', views.ProgramCertificateEligibleView.as_view(), name='program-certificate-eligible'),
    path('program/<uuid:program_id>/generate/', views.ProgramCertificateGenerateView.as_view(), name='program-certificate-generate'),
    path('program/<uuid:program_id>/send/', views.ProgramCertificateSendView.as_view(), name='program-certificate-send'),
]