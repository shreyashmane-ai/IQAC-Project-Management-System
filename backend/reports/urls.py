from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
router.register(r'columns', views.ReportColumnViewSet, basename='report-column')
router.register(r'presets', views.ReportPresetViewSet, basename='report-preset')
router.register(r'exports', views.ReportExportViewSet, basename='report-export')

urlpatterns = [
    path('', include(router.urls)),
    
    # Column catalog for a report type
    path('columns/<str:report_type>/', views.ReportColumnCatalogView.as_view(), name='report-column-catalog'),
    
    # Generate export
    path('export/', views.GenerateReportExportView.as_view(), name='generate-report-export'),
    path('export/<uuid:job_id>/', views.ReportExportStatusView.as_view(), name='report-export-status'),
]