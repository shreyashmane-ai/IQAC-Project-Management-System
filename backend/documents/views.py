"""
Documents app views
"""
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q

from .models import Document, GeneratedArtifact
from programs.models import Program
from core.models_user import AuditLog
from core.permissions import IsProgramCoordinatorOrAbove, HasProgramScope
from .serializers import DocumentSerializer, GeneratedArtifactSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = Document.objects.select_related('program', 'uploaded_by', 'validated_by').all()
        program_id = self.request.query_params.get('program')
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(original_filename__icontains=search) |
                Q(tags__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        doc = serializer.save()
        AuditLog.objects.create(
            user=self.request.user, action='upload_document',
            entity_type='Document', entity_id=doc.id,
            after={'title': doc.title, 'category': doc.category}, program_id=doc.program_id
        )

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        doc = self.get_object()
        doc.is_validated = True
        doc.validated_by = request.user
        from django.utils import timezone
        doc.validated_at = timezone.now()
        doc.validation_notes = request.data.get('notes', '')
        doc.save(update_fields=['is_validated', 'validated_by', 'validated_at', 'validation_notes', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='validate_document',
            entity_type='Document', entity_id=doc.id,
            after={'validated': True}, program_id=doc.program_id
        )
        return Response({'message': 'Document validated'})


class GeneratedArtifactViewSet(viewsets.ModelViewSet):
    serializer_class = GeneratedArtifactSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = GeneratedArtifact.objects.select_related('program', 'generated_by').all()
        program_id = self.request.query_params.get('program')
        artifact_type = self.request.query_params.get('artifact_type')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if artifact_type:
            qs = qs.filter(artifact_type=artifact_type)
        return qs

    @action(detail=True, methods=['post'], url_path='download')
    def download(self, request, pk=None):
        artifact = self.get_object()
        artifact.download_count += 1
        from django.utils import timezone
        artifact.last_downloaded = timezone.now()
        artifact.save(update_fields=['download_count', 'last_downloaded'])
        return Response({
            'file_url': artifact.file.url if artifact.file else None,
            'download_count': artifact.download_count,
        })


class ProgramDocumentViewSet(viewsets.ViewSet):
    """Program-scoped document operations (works with as_view action mapping)"""
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def _program(self):
        return Program.objects.get(id=self.kwargs['program_id'])

    def _get_object(self):
        program = self._program()
        return Document.objects.get(id=self.kwargs['pk'], program=program)

    def list(self, request, program_id=None):
        program = self._program()
        qs = Document.objects.filter(program=program).select_related('uploaded_by')
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return Response(DocumentSerializer(qs, many=True, context={'request': request}).data)

    def create(self, request, program_id=None):
        program = self._program()
        data = request.data.copy()
        data['program'] = str(program.id)
        serializer = DocumentSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        doc = serializer.save()
        AuditLog.objects.create(
            user=request.user, action='upload_document',
            entity_type='Document', entity_id=doc.id,
            after={'title': doc.title, 'category': doc.category}, program_id=program.id
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, program_id=None, pk=None):
        doc = self._get_object()
        return Response(DocumentSerializer(doc, context={'request': request}).data)

    def partial_update(self, request, program_id=None, pk=None):
        doc = self._get_object()
        serializer = DocumentSerializer(doc, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, program_id=None, pk=None):
        doc = self._get_object()
        program = doc.program
        AuditLog.objects.create(
            user=request.user, action='delete_document',
            entity_type='Document', entity_id=doc.id,
            before={'title': doc.title}, program=program
        )
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)