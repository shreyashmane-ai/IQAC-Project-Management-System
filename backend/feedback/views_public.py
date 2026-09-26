"""
Feedback public views (public feedback form)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils import timezone

from .models import FeedbackInstance, FeedbackResponse
from participants.models import Participant, Registration
from core.throttling import PublicFeedbackThrottle


class PublicFeedbackView(APIView):
    """Public feedback submission via program token"""
    permission_classes = []
    throttle_classes = [PublicFeedbackThrottle]

    def get(self, request, token):
        try:
            program = self._get_program(token)
        except RuntimeError as e:
            return Response({'error': {'code': 'NOT_FOUND', 'message': str(e)}},
                            status=status.HTTP_404_NOT_FOUND)

        if not program.feedback_link_enabled:
            return Response({'error': {'code': 'DISABLED', 'message': 'Feedback is disabled'}},
                            status=status.HTTP_403_FORBIDDEN)

        instances = FeedbackInstance.objects.filter(
            program=program, status='ACTIVE'
        ).select_related('day').order_by('-created_at')

        return Response([
            {
                'id': str(i.id),
                'title': i.title,
                'description': i.description,
                'scope': i.scope,
                'day_number': i.day.day_number if i.day else None,
                'is_anonymous': i.is_anonymous,
                'schema': i.schema,
                'closes_at': i.closes_at,
                'public_token': i.public_token,
            }
            for i in instances
        ])

    @transaction.atomic
    def post(self, request, token):
        try:
            program = self._get_program(token)
        except RuntimeError as e:
            return Response({'error': {'code': 'NOT_FOUND', 'message': str(e)}},
                            status=status.HTTP_404_NOT_FOUND)

        instance_id = request.data.get('instance_id')
        answers = request.data.get('answers', {})
        registration_number = request.data.get('registration_number', '')

        if not instance_id:
            return Response({'error': {'code': 'VALIDATION', 'message': 'instance_id required'}},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            instance = FeedbackInstance.objects.get(id=instance_id, program=program)
        except FeedbackInstance.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Feedback instance not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        if instance.status != 'ACTIVE':
            return Response({'error': {'code': 'CLOSED', 'message': 'Feedback is not active'}},
                            status=status.HTTP_403_FORBIDDEN)

        if instance.closes_at and instance.closes_at < timezone.now():
            return Response({'error': {'code': 'EXPIRED', 'message': 'Feedback window closed'}},
                            status=status.HTTP_403_FORBIDDEN)

        # Server-side validation of feedback answers against the instance schema (BE-FORM-03)
        from core.form_validation import validate_form_submission
        errors = validate_form_submission(instance.schema or {}, answers)
        if errors:
            field_errors = {}
            for fname, message in errors:
                field_errors.setdefault(fname, message)
            return Response({'error': {'code': 'VALIDATION_ERROR',
                                       'message': 'Please correct the highlighted fields.',
                                       'fieldErrors': field_errors}},
                            status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Resolve participant via registration number
        try:
            reg = Registration.objects.get(
                registration_number=registration_number, program=program,
                status__in=['APPROVED', 'SUBMITTED']
            )
        except Registration.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Invalid registration number'}},
                            status=status.HTTP_404_NOT_FOUND)

        # Dedup: one response per participant unless allow_multiple or anonymous
        if not instance.allow_multiple:
            existing = FeedbackResponse.objects.filter(
                feedback_instance=instance, participant=reg.participant
            ).exists()
            if existing:
                return Response({'error': {'code': 'DUPLICATE', 'message': 'Feedback already submitted'}},
                                status=status.HTTP_409_CONFLICT)

        response = FeedbackResponse.objects.create(
            feedback_instance=instance,
            participant=reg.participant,
            registration=reg,
            answers=answers,
            is_anonymous=bool(request.data.get('is_anonymous', instance.is_anonymous)),
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            completion_time_seconds=request.data.get('completion_time_seconds'),
        )

        from feedback.tasks import recompute_feedback_analytics
        recompute_feedback_analytics.delay(str(instance.id))

        return Response({
            'status': 'SUBMITTED',
            'response_id': str(response.id),
            'message': 'Feedback submitted successfully',
        }, status=status.HTTP_201_CREATED)

    def _get_program(self, token):
        from programs.models import Program
        try:
            return Program.objects.get(public_token=token)
        except Program.DoesNotExist:
            raise RuntimeError('Program not found')