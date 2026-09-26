"""
Feedback app views
"""
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import Http404
from django.db.models import Count, Avg

from .models import FeedbackInstance, FeedbackResponse, FeedbackAnalytics
from programs.models import Program, ProgramDay
from participants.models import Participant, Registration
from core.models_user import AuditLog
from core.permissions import HasProgramScope, IsProgramCoordinatorOrAbove
from .serializers import (
    FeedbackInstanceSerializer, FeedbackInstanceCreateSerializer,
    FeedbackResponseSerializer, FeedbackSubmissionSerializer,
    FeedbackAnalyticsSerializer, FeedbackSummarySerializer, FeedbackAnalyticsDataSerializer,
)


class FeedbackInstanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_serializer_class(self):
        if self.action == 'create':
            return FeedbackInstanceCreateSerializer
        return FeedbackInstanceSerializer

    def get_queryset(self):
        qs = FeedbackInstance.objects.select_related('program', 'day').all()
        program_id = self.request.query_params.get('program')
        scope = self.request.query_params.get('scope')
        fb_status = self.request.query_params.get('status')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if scope:
            qs = qs.filter(scope=scope)
        if fb_status:
            qs = qs.filter(status=fb_status)
        return qs

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        instance = self.get_object()
        from django.utils import timezone
        instance.status = 'ACTIVE'
        if instance.opens_at is None:
            instance.opens_at = timezone.now()
        instance.save(update_fields=['status', 'opens_at', 'updated_at'])
        return Response({'message': 'Feedback activated', 'token': instance.public_token})

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        instance = self.get_object()
        from django.utils import timezone
        instance.status = 'CLOSED'
        instance.closes_at = timezone.now()
        instance.save(update_fields=['status', 'closes_at', 'updated_at'])
        return Response({'message': 'Feedback closed'})


class FeedbackResponseViewSet(viewsets.ModelViewSet):
    serializer_class = FeedbackResponseSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = FeedbackResponse.objects.select_related('feedback_instance', 'participant').all()
        instance_id = self.request.query_params.get('instance')
        participant_id = self.request.query_params.get('participant')
        if instance_id:
            qs = qs.filter(feedback_instance_id=instance_id)
        if participant_id:
            qs = qs.filter(participant_id=participant_id)
        return qs


class FeedbackAnalyticsViewSet(viewsets.ModelViewSet):
    serializer_class = FeedbackAnalyticsSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = FeedbackAnalytics.objects.select_related('feedback_instance').all()
        instance_id = self.request.query_params.get('instance')
        if instance_id:
            qs = qs.filter(feedback_instance_id=instance_id)
        return qs

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup = self.kwargs.get(self.lookup_url_kwarg) or self.kwargs.get('pk')
        for kw in ({'pk': lookup}, {'feedback_instance_id': lookup}):
            try:
                return queryset.get(**kw)
            except FeedbackAnalytics.DoesNotExist:
                continue
            except (TypeError, ValueError):
                break
        raise Http404


class ProgramFeedbackSummaryView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        instances = FeedbackInstance.objects.filter(program=program)

        response_count = FeedbackResponse.objects.filter(feedback_instance__in=instances).count()
        registered = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        ).count()
        completion_rate = (response_count / registered * 100) if registered > 0 else 0

        avg_rating = FeedbackResponse.objects.filter(
            feedback_instance__in=instances,
            answers__rating__isnull=False,
        ).aggregate(avg=Avg('answers__rating'))['avg']

        return Response({
            'response_count': response_count,
            'completion_rate': round(completion_rate, 2),
            'average_rating': round(avg_rating, 2) if avg_rating else None,
            'open_instances': instances.filter(status='ACTIVE').count(),
            'closed_instances': instances.filter(status='CLOSED').count(),
        })


class ProgramFeedbackAnalyticsView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        instances = FeedbackInstance.objects.filter(program=program)
        responses = FeedbackResponse.objects.filter(feedback_instance__in=instances)

        registered = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        ).count()
        response_count = responses.count()
        response_rate = (response_count / registered * 100) if registered > 0 else 0

        # Per-question analytics (simplified - iterate responses)
        per_question = {}
        for r in responses:
            for q_name, value in r.answers.items():
                if q_name == 'rating':
                    continue
                if q_name not in per_question:
                    per_question[q_name] = {'count': 0, 'sum': 0, 'values': []}
                per_question[q_name]['count'] += 1
                if isinstance(value, (int, float)):
                    per_question[q_name]['sum'] += value
                    per_question[q_name]['values'].append(value)

        # Rating distribution
        rating_dist = {}
        for r in responses:
            rating = r.answers.get('rating')
            if rating is not None:
                rating_dist[str(rating)] = rating_dist.get(str(rating), 0) + 1

        # Satisfaction
        satisfaction = None
        if rating_dist:
            total = sum(rating_dist.values())
            top = sum(v for k, v in rating_dist.items() if int(k) >= 4)
            satisfaction = (top / total * 100) if total > 0 else None

        comments = [
            {'participant': r.participant.full_name, 'comment': r.answers.get('comments', '')}
            for r in responses if r.answers.get('comments')
        ]

        result = {
            'total_responses': response_count,
            'response_rate': round(response_rate, 2),
            'per_question': per_question,
            'rating_distribution': rating_dist,
            'satisfaction_percentage': round(satisfaction, 2) if satisfaction else None,
            'comments': comments,
        }
        return Response(result)