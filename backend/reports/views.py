"""
Reports app views
"""
import uuid
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import ReportColumn, ReportPreset, ReportExport, ReportType
from programs.models import Program, AcademicSession
from core.models_user import AuditLog
from core.permissions import HasProgramScope, IsProgramCoordinatorOrAbove
from .serializers import (
    ReportColumnSerializer, ReportColumnCatalogSerializer,
    ReportPresetSerializer, ReportPresetCreateSerializer,
    ReportExportSerializer, GenerateReportExportSerializer, ReportExportStatusSerializer,
)


class ReportColumnViewSet(viewsets.ModelViewSet):
    queryset = ReportColumn.objects.all()
    serializer_class = ReportColumnSerializer
    permission_classes = [IsProgramCoordinatorOrAbove]


class ReportPresetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_serializer_class(self):
        if self.action == 'create':
            return ReportPresetCreateSerializer
        return ReportPresetSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ReportPreset.objects.select_related('program', 'created_by').all()
        if not user.is_program_admin:
            qs = qs.filter(
                models.Q(created_by=user) |
                models.Q(is_shared=True, shared_with=user) |
                models.Q(is_global=True)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ReportExportViewSet(viewsets.ModelViewSet):
    serializer_class = ReportExportSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = ReportExport.objects.select_related('program', 'academic_session').all()
        program_id = self.request.query_params.get('program')
        rpt_status = self.request.query_params.get('status')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if rpt_status:
            qs = qs.filter(status=rpt_status)
        return qs.order_by('-created_at')


class ReportColumnCatalogView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, report_type):
        columns = ReportColumn.objects.filter(report_type=report_type).order_by('sort_order')
        return Response({
            'report_type': report_type,
            'columns': ReportColumnSerializer(columns, many=True).data,
        })


class GenerateReportExportView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request):
        serializer = GenerateReportExportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create export record
        export = ReportExport.objects.create(
            program_id=data.get('program_id'),
            academic_session_id=data.get('session_id'),
            report_type=data['report_type'],
            selected_columns=data.get('selected_columns', []),
            filters=data.get('filters', {}),
            format=data['format'],
            status='QUEUED',
            created_by=request.user,
        )

        # Enqueue async task
        from reports.tasks import generate_export
        task = generate_export.delay(str(export.id))
        export.celery_task_id = task.id if hasattr(task, 'id') else ''
        export.save(update_fields=['celery_task_id'])

        AuditLog.objects.create(
            user=request.user, action='export_report',
            entity_type='ReportExport', entity_id=export.id,
            after={'report_type': data['report_type'], 'format': data['format'] },
            program_id=export.program_id
        )
        return Response({'job_id': str(export.id), 'message': 'Export queued'})


class ReportExportStatusView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, job_id):
        try:
            export = ReportExport.objects.get(id=job_id)
        except ReportExport.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Export not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        data = {
            'job_id': str(export.id),
            'status': export.status,
            'progress': self._compute_progress(export),
            'file_url': export.file.url if export.file else None,
            'row_count': export.row_count,
            'error_message': export.error_message,
        }
        return Response(data)

    def _compute_progress(self, export):
        if export.status == 'COMPLETED':
            return 100
        if export.status == 'FAILED':
            return 0
        if export.status == 'PROCESSING':
            return 50
        return 5


from django.db import models