"""
Programs app views
"""
import json
import secrets
from rest_framework import viewsets, generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db import models as db_models

from .models import (
    AcademicSession,
    Program,
    ProgramDay,
    ProgramServiceConfig,
    AcademicDepartment,
    AdministrativeDepartment,
    Designation,
    ProgramType,
    Venue,
    QuestionType,
    FoodType,
)
from core.models_user import AuditLog
from core.permissions import IsProgramAdminOrAbove, IsProgramCoordinatorOrAbove, HasProgramScope
from .serializers import (
    AcademicSessionSerializer, AcademicSessionCreateSerializer,
    AcademicDepartmentSerializer, AdministrativeDepartmentSerializer,
    DesignationSerializer, ProgramTypeSerializer,
    VenueSerializer, QuestionTypeSerializer, FoodTypeSerializer,
    ProgramListSerializer, ProgramDetailSerializer, ProgramCreateSerializer, ProgramUpdateSerializer,
    ProgramDaySerializer, ProgramDayBulkSerializer,
    ProgramServiceConfigSerializer,
    ProgramStatusSerializer, ProgramLinkSerializer, ProgramLinkStateSerializer,
    RegistrationFormSerializer, FeedbackFormSerializer,
    ProgramDashboardSerializer, ProgramClosureReadinessSerializer,
    FieldTypeSerializer,
)


def _json_safe(data):
    """Return a JSON-serializable copy of serializer.data (UUID/datetime -> str)."""
    return json.loads(json.dumps(data, default=str))



class AcademicSessionViewSet(viewsets.ModelViewSet):
    queryset = AcademicSession.objects.all()
    permission_classes = [IsProgramAdminOrAbove]

    def get_serializer_class(self):
        if self.action == 'create':
            return AcademicSessionCreateSerializer
        return AcademicSessionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get('active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        session = self.get_object()
        session.is_active = True
        session.save()
        AuditLog.objects.create(
            user=request.user, action='activate',
            entity_type='AcademicSession', entity_id=session.id,
            after={'is_active': True}, program_id=None
        )
        return Response({'message': f'Session {session.code} activated'})

    @action(detail=True, methods=['get'])
    def analysis(self, request, pk=None):
        session = self.get_object()
        programs = Program.objects.filter(academic_session=session)
        data = {
            'session_code': session.code,
            'total_programs': programs.count(),
            'programs_by_status': {},
            'total_registrations': 0,
            'total_attendance': 0,
            'total_food_claims': 0,
            'total_feedback': 0,
            'total_certificates': 0,
        }
        for status_val, _ in Program.Status.choices:
            count = programs.filter(status=status_val).count()
            if count > 0:
                data['programs_by_status'][status_val] = count
        return Response(data)


def build_master_viewset(model, serializer_class):
    """Factory: a ModelViewSet for a per-master table."""

    def get_queryset(self):
        qs = model.objects.all()
        is_active = self.request.query_params.get('active')
        search = self.request.query_params.get('search')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def perform_create(self, serializer):
        inst = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            entity_type=model.__name__,
            entity_id=inst.id,
            after=serializer.data,
        )

    def perform_update(self, serializer):
        before = self.get_object()
        inst = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            entity_type=model.__name__,
            entity_id=inst.id,
            before=self.get_serializer_class()(before).data,
            after=serializer.data,
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='delete',
            entity_type=model.__name__,
            entity_id=instance.id,
            before=self.get_serializer_class()(instance).data,
        )
        instance.delete()

    attrs = {
        'queryset': model.objects.all(),
        'serializer_class': serializer_class,
        'permission_classes': [IsProgramAdminOrAbove],
        'get_queryset': get_queryset,
        'perform_create': perform_create,
        'perform_update': perform_update,
        'perform_destroy': perform_destroy,
    }
    return type(model.__name__ + 'ViewSet', (viewsets.ModelViewSet,), attrs)


AcademicDepartmentViewSet = build_master_viewset(AcademicDepartment, AcademicDepartmentSerializer)
AdministrativeDepartmentViewSet = build_master_viewset(AdministrativeDepartment, AdministrativeDepartmentSerializer)
DesignationViewSet = build_master_viewset(Designation, DesignationSerializer)
ProgramTypeViewSet = build_master_viewset(ProgramType, ProgramTypeSerializer)
VenueViewSet = build_master_viewset(Venue, VenueSerializer)
QuestionTypeViewSet = build_master_viewset(QuestionType, QuestionTypeSerializer)
FoodTypeViewSet = build_master_viewset(FoodType, FoodTypeSerializer)


class ProgramViewSet(viewsets.ModelViewSet):
    permission_classes = [HasProgramScope]

    def get_queryset(self):
        qs = Program.objects.select_related(
            'academic_session', 'program_type', 'program_coordinator'
        ).prefetch_related('organizing_departments').all()
        user = self.request.user
        scopes = user.get_program_scopes()
        if scopes is not None:
            qs = qs.filter(id__in=scopes)
        academic_session = self.request.query_params.get('session')
        program_status = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        program_type = self.request.query_params.get('type')
        department = self.request.query_params.get('department')
        departments = self.request.query_params.get('departments')
        if academic_session:
            qs = qs.filter(academic_session_id=academic_session)
        if program_status:
            qs = qs.filter(status=program_status)
        if search:
            qs = qs.filter(
                db_models.Q(title__icontains=search) |
                db_models.Q(short_code__icontains=search)
            )
        if program_type:
            qs = qs.filter(program_type_id=program_type)
        if department:
            qs = qs.filter(organizing_departments__id=department)
        if departments:
            dept_ids = [d.strip() for d in departments.split(',') if d.strip()]
            if dept_ids:
                qs = qs.filter(organizing_departments__id__in=dept_ids)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ProgramListSerializer
        elif self.action == 'create':
            return ProgramCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ProgramUpdateSerializer
        return ProgramDetailSerializer

    def perform_create(self, serializer):
        program = serializer.save(created_by=self.request.user)
        self._generate_days(program)
        AuditLog.objects.create(
            user=self.request.user, action='create',
            entity_type='Program', entity_id=program.id,
            after=_json_safe(ProgramListSerializer(program).data), program_id=program.id
        )

    def perform_update(self, serializer):
        old_data = ProgramListSerializer(self.get_object()).data
        program = serializer.save(updated_by=self.request.user)
        new_num_days = serializer.validated_data.get('number_of_days')
        if new_num_days is not None:
            self._sync_days(program, new_num_days)
        AuditLog.objects.create(
            user=self.request.user, action='update',
            entity_type='Program', entity_id=program.id,
            before=_json_safe(old_data), after=_json_safe(ProgramListSerializer(program).data), program_id=program.id
        )

    def _generate_days(self, program):
        from datetime import timedelta
        for i in range(1, program.number_of_days + 1):
            day_date = program.start_date + timedelta(days=i - 1)
            ProgramDay.objects.create(
                program=program, day_number=i, date=day_date,
                created_by=self.request.user,
            )

    def _sync_days(self, program, new_count):
        current_days = program.days.count()
        from datetime import timedelta
        if new_count > current_days:
            for i in range(current_days + 1, new_count + 1):
                day_date = program.start_date + timedelta(days=i - 1)
                ProgramDay.objects.create(
                    program=program, day_number=i, date=day_date,
                    created_by=self.request.user,
                )
        elif new_count < current_days:
            days_to_remove = program.days.filter(day_number__gt=new_count)
            has_data = False
            for day in days_to_remove:
                if day.attendance_records.exists() or day.food_services.exists() or day.feedback_instances.exists():
                    has_data = True
                    break
            if has_data:
                days_to_remove.update(is_cancelled=True, cancellation_reason='Program duration reduced')
            else:
                days_to_remove.delete()

    def perform_destroy(self, instance):
        if instance.status != Program.Status.DRAFT:
            raise Exception("Only draft programs can be deleted")
        AuditLog.objects.create(
            user=self.request.user, action='delete',
            entity_type='Program', entity_id=instance.id,
            before=_json_safe(ProgramListSerializer(instance).data), program_id=instance.id
        )
        instance.delete()


class ProgramStatusView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    VALID_TRANSITIONS = {
        Program.Status.DRAFT: [Program.Status.PUBLISHED, Program.Status.CANCELLED],
        Program.Status.PUBLISHED: [Program.Status.REGISTRATION_OPEN, Program.Status.POSTPONED, Program.Status.CANCELLED],
        Program.Status.REGISTRATION_OPEN: [Program.Status.REGISTRATION_CLOSED, Program.Status.CANCELLED],
        Program.Status.REGISTRATION_CLOSED: [Program.Status.ONGOING, Program.Status.POSTPONED, Program.Status.CANCELLED],
        Program.Status.ONGOING: [Program.Status.COMPLETED, Program.Status.RESCHEDULED],
        Program.Status.POSTPONED: [Program.Status.RESCHEDULED, Program.Status.CANCELLED],
        Program.Status.RESCHEDULED: [Program.Status.ONGOING, Program.Status.CANCELLED],
        Program.Status.COMPLETED: [Program.Status.ARCHIVED],
    }

    def post(self, request, program_id):
        program = Program.objects.get(id=program_id)
        serializer = ProgramStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['to']
        reason = serializer.validated_data.get('reason', '')
        allowed = self.VALID_TRANSITIONS.get(program.status, [])
        if new_status not in allowed:
            return Response({
                'error': {
                    'code': 'CONFLICT',
                    'message': f'Cannot transition from {program.status} to {new_status}',
                }
            }, status=status.HTTP_409_CONFLICT)
        old_status = program.status
        program.status = new_status
        program.save(update_fields=['status', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='status_change',
            entity_type='Program', entity_id=program.id,
            before={'status': old_status}, after={'status': new_status, 'reason': reason},
            program_id=program.id
        )
        return Response({'message': f'Status changed to {new_status}', 'status': new_status})


class ProgramLinkView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        serializer = ProgramLinkSerializer(program, context={'request': request})
        return Response(serializer.data)


class ProgramLinkRegenerateView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request, program_id):
        program = Program.objects.get(id=program_id)
        old_token = program.public_token
        program.public_token = secrets.token_urlsafe(32)
        program.save(update_fields=['public_token', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='regenerate_token',
            entity_type='Program', entity_id=program.id,
            before={'token': old_token}, after={'token': program.public_token},
            program_id=program.id
        )
        serializer = ProgramLinkSerializer(program, context={'request': request})
        return Response(serializer.data)


class ProgramLinkStateView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request, program_id):
        program = Program.objects.get(id=program_id)
        serializer = ProgramLinkStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = serializer.validated_data['service']
        enabled = serializer.validated_data['enabled']
        if service == 'public':
            program.public_link_enabled = enabled
        elif service == 'registration':
            program.registration_link_enabled = enabled
        elif service == 'feedback':
            program.feedback_link_enabled = enabled
        program.save(update_fields=[f'{service}_link_enabled', 'updated_at'])
        return Response({'message': f'{service} link {"enabled" if enabled else "disabled"}'})


class RegistrationFormView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        return Response({'schema': program.registration_schema})

    def put(self, request, program_id):
        program = Program.objects.get(id=program_id)
        serializer = RegistrationFormSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program.registration_schema = serializer.validated_data['schema']
        program.save(update_fields=['registration_schema', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='update_form',
            entity_type='Program', entity_id=program.id, program_id=program.id
        )
        return Response({'message': 'Registration form updated', 'schema': program.registration_schema})


class FeedbackFormView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        return Response({'schema': program.feedback_schema})

    def put(self, request, program_id):
        program = Program.objects.get(id=program_id)
        serializer = FeedbackFormSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program.feedback_schema = serializer.validated_data['schema']
        program.save(update_fields=['feedback_schema', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='update_form',
            entity_type='Program', entity_id=program.id, program_id=program.id
        )
        return Response({'message': 'Feedback form updated', 'schema': program.feedback_schema})


class ProgramDashboardView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        registrations = program.registrations.all()
        approved = registrations.filter(status__in=['APPROVED', 'SUBMITTED'])
        days = program.days.all()
        attendance_records = program.attendance_records.filter(is_present=True)

        total_registered = approved.count()
        present_count = attendance_records.values('participant').distinct().count()
        attendance_rate = (present_count / total_registered * 100) if total_registered > 0 else 0

        from food.models import FoodEligibility
        food_eligible = FoodEligibility.objects.filter(
            food_service__program=program, is_eligible=True
        ).count()
        food_claimed = FoodEligibility.objects.filter(
            food_service__program=program, qr_sent=True
        ).count()

        from feedback.models import FeedbackResponse
        feedback_count = FeedbackResponse.objects.filter(feedback_instance__program=program).count()
        feedback_rate = (feedback_count / total_registered * 100) if total_registered > 0 else 0

        from certificates.models import Certificate
        certificates_issued = Certificate.objects.filter(
            program=program, status__in=['GENERATED', 'SENT']
        ).count()

        upcoming = days.filter(date__gte=timezone.now().date(), is_cancelled=False).order_by('date')[:5]
        upcoming_list = [{'day_number': d.day_number, 'date': str(d.date)} for d in upcoming]

        data = {
            'registration_count': total_registered,
            'approved_count': approved.count(),
            'waitlist_count': registrations.filter(status='WAITLISTED').count(),
            'attendance_rate': round(attendance_rate, 2),
            'food_eligible': food_eligible,
            'food_claimed': food_claimed,
            'feedback_count': feedback_count,
            'feedback_rate': round(feedback_rate, 2),
            'certificates_issued': certificates_issued,
            'certificates_pending': max(0, total_registered - certificates_issued),
            'upcoming_days': upcoming_list,
            'recent_activity': [],
        }
        return Response(data)


class ProgramClosureReadinessView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get(self, request, program_id):
        program = Program.objects.get(id=program_id)
        blockers = []
        reg_closed = program.status in [Program.Status.REGISTRATION_CLOSED, Program.Status.ONGOING, Program.Status.COMPLETED]
        if not reg_closed:
            blockers.append('Registration not closed')
        att_finalized = not program.days.filter(attendance_enabled=True, attendance_session__status__in=['SCHEDULED', 'ACTIVE']).exists()
        if not att_finalized:
            blockers.append('Attendance sessions still active')
        fb_closed = not program.feedback_instances.filter(status__in=['SCHEDULED', 'ACTIVE']).exists()
        if not fb_closed:
            blockers.append('Feedback instances still active')
        certs_done = program.certificates.filter(status='GENERATED').count() == 0
        if not certs_done:
            blockers.append('Some certificates not yet sent')
        docs_uploaded = program.documents.exists()
        if not docs_uploaded:
            blockers.append('Documents not yet uploaded')
        food_finalized = not program.days.filter(
            food_enabled=True
        ).exclude(
            food_services__is_active=True, food_services__qr_generated=True
        ).exists()
        if not food_finalized:
            blockers.append('Food services not generated for every food-enabled day')

        data = {
            'registration_closed': reg_closed,
            'attendance_finalized': att_finalized,
            'food_finalized': food_finalized,
            'feedback_closed': fb_closed,
            'certificates_handled': certs_done,
            'documents_uploaded': docs_uploaded,
            'blockers': blockers,
            'can_close': len(blockers) == 0,
        }
        return Response(data)


class ProgramClosureView(APIView):
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def post(self, request, program_id):
        program = Program.objects.get(id=program_id)
        if program.status != Program.Status.COMPLETED:
            return Response({
                'error': {'code': 'CONFLICT', 'message': 'Program must be Completed before closing'}
            }, status=status.HTTP_409_CONFLICT)
        program.status = Program.Status.ARCHIVED
        program.save(update_fields=['status', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='close',
            entity_type='Program', entity_id=program.id,
            after={'status': Program.Status.ARCHIVED}, program_id=program.id
        )
        return Response({'message': 'Program archived successfully'})


from django.utils import timezone


class ProgramDayViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramDaySerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = ProgramDay.objects.all()
        program_id = self.request.query_params.get('program')
        if program_id:
            qs = qs.filter(program_id=program_id)
        return qs.order_by('program', 'day_number')


class ProgramServiceConfigViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramServiceConfigSerializer
    permission_classes = [IsProgramCoordinatorOrAbove, HasProgramScope]

    def get_queryset(self):
        qs = ProgramServiceConfig.objects.all()
        program_id = self.request.query_params.get('program')
        day_id = self.request.query_params.get('day')
        service_type = self.request.query_params.get('type')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if day_id:
            qs = qs.filter(day_id=day_id)
        if service_type:
            qs = qs.filter(service_type=service_type)
        return qs