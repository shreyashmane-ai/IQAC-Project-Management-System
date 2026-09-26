from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
# NOTE: the root '' viewset is registered LAST so its catch-all detail route
# does not shadow the named single-segment prefixes above.
router.register(r'artifacts', views.GeneratedArtifactViewSet, basename='artifact')
router.register(r'', views.DocumentViewSet, basename='document')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program scoped
    path('program/<uuid:program_id>/', views.ProgramDocumentViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='program-documents'),
    path('program/<uuid:program_id>/<uuid:pk>/', views.ProgramDocumentViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'delete': 'destroy',
    }), name='program-document-detail'),
]