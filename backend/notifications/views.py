"""
Notifications app views
"""
from django.template import Template, Context
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from .models import (
    NotificationTemplate, NotificationMessage, NotificationBatch, NotificationChannel,
)
from programs.models import Program
from participants.models import Participant, Registration
from core.permissions import IsProgramCoordinatorOrAbove, HasProgramScope
from .serializers import (
    NotificationTemplateSerializer, NotificationMessageSerializer,
    NotificationBatchSerializer, SendNotificationBatchSerializer,
    NotificationMessageCreateSerializer,
)


class NotificationTemplateViewSet(viewsets.ModelViewSet):
    queryset = NotificationTemplate.objects.all()
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsProgramCoordinatorOrAbove]

    def get_queryset(self):
        qs = super().get_queryset()
        trigger = self.request.query_params.get('trigger')
        channel = self.request.query_params.get('channel')
        is_active = self.request.query_params.get('is_active')
        if trigger:
            qs = qs.filter(trigger=trigger)
        if channel:
            qs = qs.filter(channel=channel)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs


class NotificationMessageViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationMessageSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = NotificationMessage.objects.select_related(
            'template', 'program', 'participant', 'registration'
        ).all()
        program_id = self.request.query_params.get('program')
        m_status = self.request.query_params.get('status')
        template_id = self.request.query_params.get('template')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if m_status:
            qs = qs.filter(status=m_status)
        if template_id:
            qs = qs.filter(template_id=template_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = NotificationMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        template = NotificationTemplate.objects.get(id=data['template_id'])
        program = Program.objects.get(id=data['program_id'])

        registrations = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        )
        if data.get('participant_ids'):
            registrations = registrations.filter(participant_id__in=data['participant_ids'])

        messages = []
        for reg in registrations:
            participant = reg.participant
            context = {
                'participant_name': participant.full_name,
                'program_title': program.title,
                'registration_number': reg.registration_number,
                **(data.get('context_extra') or {}),
            }
            subject = Template(template.subject_template).render(Context(context))
            html = Template(template.html_template).render(Context(context))
            text = Template(template.text_template or template.subject_template).render(Context(context))

            messages.append(NotificationMessage.objects.create(
                template=template,
                program=program,
                participant=participant,
                registration=reg,
                subject=subject,
                html_content=html,
                text_content=text,
                channel=template.channel,
                recipient_address=data.get('recipient_address') or participant.email,
                idempotency_key=f"{template.trigger}-{program.id}-{participant.id}-{template.id}",
            ))

        return Response({
            'created': len(messages),
            'message': 'Notification messages created and queued',
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        message = self.get_object()
        from notifications.tasks import send_notification_message
        send_notification_message.delay(str(message.id))
        return Response({'message': 'Message resend queued'})


class NotificationBatchViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationBatchSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = NotificationBatch.objects.select_related('program', 'template').all()
        program_id = self.request.query_params.get('program')
        b_status = self.request.query_params.get('status')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if b_status:
            qs = qs.filter(status=b_status)
        return qs


class SendNotificationBatchView(APIView):
    """Create and dispatch a notification batch to matching participants."""
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request, program_id):
        serializer = SendNotificationBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        program = Program.objects.get(id=program_id)
        channel = data.get('channel', NotificationChannel.EMAIL)

        template = None
        if data.get('trigger'):
            template = NotificationTemplate.objects.filter(
                trigger=data['trigger'], is_active=True
            ).first()
            if template:
                channel = data.get('channel') or template.channel

        # Resolve participants
        registrations = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        )
        reg_filter = data.get('registration_filter') or {}
        if reg_filter.get('status'):
            registrations = registrations.filter(status=reg_filter['status'])

        participants = [reg.participant for reg in registrations.select_related('participant')]
        if not participants:
            return Response({'error': {'code': 'EMPTY', 'message': 'No matching participants'}},
                            status=status.HTTP_400_BAD_REQUEST)

        batch = NotificationBatch.objects.create(
            program=program,
            template=template,
            participant_filter=part_filter,
            registration_filter=reg_filter,
            total=len(participants),
            status='QUEUED',
        )

        from notifications.tasks import process_batch
        task = process_batch.delay(str(batch.id))
        batch.celery_task_id = task.id if hasattr(task, 'id') else ''
        batch.pending = len(participants)
        batch.save(update_fields=['celery_task_id', 'status', 'pending'])

        return Response({
            'batch_id': str(batch.id),
            'total': len(participants),
            'channel': channel,
            'message': 'Notification batch queued',
        }, status=status.HTTP_202_ACCEPTED)