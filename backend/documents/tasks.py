"""
Documents app Celery tasks
"""
import io
from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone


@shared_task
def generate_artifact(document_id, artifact_type='PROGRAM_REPORT'):
    """Generate a derived artifact (e.g., PDF/export) for a document."""
    from .models import Document, GeneratedArtifact

    try:
        doc = Document.objects.select_related('program').get(id=document_id)
    except Document.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    try:
        # Placeholder rendering - in production this would invoke a PDF/render service
        content = io.BytesIO(f"{doc.title}\n{doc.description}\n".encode('utf-8'))
        artifact = GeneratedArtifact.objects.create(
            program=doc.program,
            artifact_type=artifact_type,
            related_object_id=doc.id,
            file_size=content.getbuffer().nbytes,
        )
        artifact.file.save(
            f"{doc.program.short_code}-{artifact_type.lower()}-{doc.id}.txt",
            ContentFile(content.getvalue()),
            save=True,
        )
        import secrets
        artifact.access_token = secrets.token_urlsafe(32)
        artifact.save(update_fields=['access_token'])
        return {
            'status': 'GENERATED',
            'artifact_id': str(artifact.id),
            'access_token': artifact.access_token,
        }
    except Exception as exc:
        return {'status': 'FAILED', 'error': str(exc)}