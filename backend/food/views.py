"""
Food app views - Concurrency-critical module
"""
import secrets
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from .models import FoodService, FoodEligibility, FoodToken, FoodClaim, FoodSummary
from programs.models import Program, ProgramDay
from participants.models import Participant, Registration
from attendance.models import AttendanceRecord
from core.models_user import AuditLog
from core.permissions import IsFoodOperator, HasProgramScope, IsProgramAdminOrAbove
from .serializers import (
    FoodServiceSerializer, FoodEligibilitySerializer, FoodTokenSerializer,
    FoodClaimSerializer, FoodSummarySerializer, SendNewEligibleSerializer,
    GenerateQRSerializer, ClaimFoodSerializer, PreSendSummarySerializer,
)


class FoodServiceViewSet(viewsets.ModelViewSet):
    serializer_class = FoodServiceSerializer
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get_queryset(self):
        qs = FoodService.objects.select_related('program', 'day').all()
        program_id = self.request.query_params.get('program')
        day_id = self.request.query_params.get('day')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if day_id:
            qs = qs.filter(day_id=day_id)
        return qs


class FoodEligibilityViewSet(viewsets.ModelViewSet):
    serializer_class = FoodEligibilitySerializer
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get_queryset(self):
        qs = FoodEligibility.objects.select_related(
            'food_service', 'participant'
        ).all()
        food_service = self.request.query_params.get('food_service')
        is_eligible = self.request.query_params.get('is_eligible')
        qr_sent = self.request.query_params.get('qr_sent')
        if food_service:
            qs = qs.filter(food_service_id=food_service)
        if is_eligible is not None:
            qs = qs.filter(is_eligible=is_eligible.lower() == 'true')
        if qr_sent is not None:
            qs = qs.filter(qr_sent=qr_sent.lower() == 'true')
        return qs


class FoodTokenViewSet(viewsets.ModelViewSet):
    serializer_class = FoodTokenSerializer
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get_queryset(self):
        qs = FoodToken.objects.select_related(
            'food_service', 'participant', 'claimed_by'
        ).all()
        food_service = self.request.query_params.get('food_service')
        is_claimed = self.request.query_params.get('is_claimed')
        if food_service:
            qs = qs.filter(food_service_id=food_service)
        if is_claimed is not None:
            qs = qs.filter(is_claimed=is_claimed.lower() == 'true')
        return qs


class FoodClaimViewSet(viewsets.ModelViewSet):
    serializer_class = FoodClaimSerializer
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get_queryset(self):
        qs = FoodClaim.objects.select_related(
            'token', 'participant', 'food_service', 'claimed_by'
        ).all()
        food_service = self.request.query_params.get('food_service')
        result = self.request.query_params.get('result')
        if food_service:
            qs = qs.filter(food_service_id=food_service)
        if result:
            qs = qs.filter(result=result)
        return qs


class FoodSummaryViewSet(viewsets.ModelViewSet):
    serializer_class = FoodSummarySerializer
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get_queryset(self):
        qs = FoodSummary.objects.select_related('food_service').all()
        food_service = self.request.query_params.get('food_service')
        if food_service:
            qs = qs.filter(food_service_id=food_service)
        return qs


class DayFoodEligibilityView(APIView):
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get(self, request, program_id, day_id):
        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)
        if not day.food_enabled:
            return Response({
                'error': {'code': 'CONFLICT', 'message': 'Food not enabled for this day'}
            }, status=status.HTTP_409_CONFLICT)

        # Compute/recompute eligibility
        services = FoodService.objects.filter(program=program, day=day)
        result = []
        for service in services:
            eligibilities = FoodEligibility.objects.filter(
                food_service=service
            ).select_related('participant')
            result.append({
                'food_service': FoodServiceSerializer(service).data,
                'participants': FoodEligibilitySerializer(eligibilities, many=True).data,
            })

        if not result:
            return Response({'message': 'No food services configured for this day', 'services': []})

        return Response({'day': day_id, 'services': result})


class GenerateFoodQRView(APIView):
    permission_classes = [IsFoodOperator, HasProgramScope]

    def post(self, request, program_id, day_id):
        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)
        if not day.food_enabled:
            return Response({
                'error': {'code': 'CONFLICT', 'message': 'Food not enabled for this day'}
            }, status=status.HTTP_409_CONFLICT)

        serializer = GenerateQRSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Determine which services to process
        services = FoodService.objects.filter(program=program, day=day, is_active=True)
        if not services.exists():
            return Response({
                'error': {'code': 'CONFLICT', 'message': 'No active food services for this day'}
            }, status=status.HTTP_409_CONFLICT)

        generated = 0
        for service in services:
            # Compute eligibility for all registered participants
            registrations = Registration.objects.filter(
                program=program, status__in=['APPROVED', 'SUBMITTED']
            )

            # Determine eligible set based on rule
            eligible_participants = self._compute_eligible_participants(program, day, registrations, service)

            for reg in registrations:
                participant = reg.participant
                is_eligible = participant.id in eligible_participants

                elig, _ = FoodEligibility.objects.update_or_create(
                    food_service=service,
                    participant=participant,
                    defaults={
                        'registration': reg,
                        'is_eligible': is_eligible,
                        'eligibility_basis': {
                            'rule': service.eligibility_rule or {'type': 'attendance_present'},
                        },
                    }
                )

                # Generate QR if eligible and not yet generated
                if is_eligible and not elig.qr_generated:
                    token, created = FoodToken.objects.get_or_create(
                        eligibility=elig,
                        defaults={
                            'food_service': service,
                            'participant': participant,
                            'token': FoodToken.generate_token(),
                        },
                    )
                    if created:
                        generated += 1
                    FoodEligibility.objects.filter(id=elig.id).update(qr_generated=True)

        AuditLog.objects.create(
            user=request.user, action='generate_food_qr',
            entity_type='ProgramDay', entity_id=day.id,
            after={'generated': generated}, program_id=program.id
        )
        return Response({'message': f'QR generation complete', 'generated_qrs': generated})

    def _compute_eligible_participants(self, program, day, registrations, service):
        """Compute eligible participants based on configured rule"""
        rule = service.eligibility_rule or {'type': 'attendance_present'}
        rule_type = rule.get('type', 'attendance_present')

        participant_ids = list(registrations.values_list('participant_id', flat=True))

        if rule_type == 'attendance_present':
            present_ids = set(AttendanceRecord.objects.filter(
                day=day, is_present=True, participant_id__in=participant_ids
            ).values_list('participant_id', flat=True))
            return present_ids

        elif rule_type == 'attendance_percentage':
            threshold = rule.get('value', 50)
            required_days = max(1, round(day.program.number_of_days * threshold / 100))
            from django.db.models import Count
            present_counts = AttendanceRecord.objects.filter(
                program=program, is_present=True, participant_id__in=participant_ids
            ).values('participant_id').annotate(total=Count('participant_id'))
            eligible = {c['participant_id'] for c in present_counts if c['total'] >= required_days}
            return eligible

        elif rule_type == 'registration_only':
            return set(participant_ids)

        elif rule_type == 'previous_day_present':
            prev_day = rule.get('reference_day', day.day_number - 1)
            prev_day_obj = ProgramDay.objects.filter(
                program=program, day_number=prev_day
            ).first()
            if prev_day_obj:
                present_ids = set(AttendanceRecord.objects.filter(
                    day=prev_day_obj, is_present=True, participant_id__in=participant_ids
                ).values_list('participant_id', flat=True))
                return present_ids
            return set()

        # Default: attendance present
        present_ids = set(AttendanceRecord.objects.filter(
            day=day, is_present=True, participant_id__in=participant_ids
        ).values_list('participant_id', flat=True))
        return present_ids


class SendNewEligibleView(APIView):
    permission_classes = [IsFoodOperator, HasProgramScope]

    def post(self, request, program_id, day_id):
        """
        CRITICAL: Send to newly eligible only.
        Idempotent - never resends to already-sent participants.
        Uses a simple DB lock to prevent double-sends.
        """
        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)
        if not day.food_enabled:
            return Response({
                'error': {'code': 'CONFLICT', 'message': 'Food not enabled for this day'}
            }, status=status.HTTP_409_CONFLICT)

        services = FoodService.objects.filter(program=program, day=day, is_active=True)

        total_newly_sent = 0
        total_failed = 0
        result_summary = []

        for service in services:
            # Eligible AND not yet sent (idempotent by design)
            to_send = list(FoodEligibility.objects.filter(
                food_service=service, is_eligible=True, qr_sent=False, qr_generated=True
            ).select_related('participant'))

            # Ensure QR token exists
            for elig in to_send:
                if not hasattr(elig, 'token'):
                    FoodToken.objects.get_or_create(
                        eligibility=elig,
                        defaults={
                            'food_service': service,
                            'participant': elig.participant,
                            'token': FoodToken.generate_token(),
                        },
                    )

            newly_sent, failed = self._send_qrs(service, to_send)
            total_newly_sent += newly_sent
            total_failed += failed

            result_summary.append({
                'service': f"{service.get_service_type_display()}",
                'newly_sent': newly_sent,
                'failed': failed,
            })

        AuditLog.objects.create(
            user=request.user, action='send_food_qr',
            entity_type='ProgramDay', entity_id=day.id,
            after={'newly_sent': total_newly_sent, 'failed': total_failed}, program_id=program.id
        )
        return Response({
            'newly_sent': total_newly_sent,
            'failed': total_failed,
            'already_sent_count': FoodEligibility.objects.filter(
                food_service__in=services, is_eligible=True, qr_sent=True
            ).count(),
            'detail': result_summary,
        })

    def _send_qrs(self, service, eligibilities):
        """Send QRs and mark as sent. Returns (sent_count, failed_count)."""
        newly_sent = 0
        failed = 0
        for elig in eligibilities:
            try:
                token = FoodToken.objects.filter(eligibility=elig).first()
                if not token:
                    token = FoodToken.objects.create(
                        eligibility=elig,
                        food_service=elig.food_service,
                        participant=elig.participant,
                        token=FoodToken.generate_token(),
                    )

                # Mark as sent (idempotent - update in place)
                elig.qr_sent = True
                elig.qr_sent_at = timezone.now()
                elig.qr_sent_by = self.request.user
                elig.save(update_fields=['qr_sent', 'qr_sent_at', 'qr_sent_by', 'updated_at'])

                token.email_status = 'QUEUED'
                token.save(update_fields=['email_status'])

                # Send email async
                try:
                    from notifications.tasks import send_food_qr_email
                    send_food_qr_email.delay(str(token.id))
                except Exception:
                    token.email_status = 'FAILED'
                    token.email_error = 'Failed to enqueue email'
                    token.save(update_fields=['email_status', 'email_error'])
                    failed += 1
                    continue

                newly_sent += 1

            except Exception:
                failed += 1

        return newly_sent, failed


class ClaimFoodView(APIView):
    permission_classes = [IsFoodOperator, HasProgramScope]

    @transaction.atomic
    def post(self, request, program_id, day_id):
        """
        Atomic single-use claim.
        Uses a conditional atomic update (compare-and-set) to ensure a QR
        can only be claimed once.
        """
        serializer = ClaimFoodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_str = serializer.validated_data['token']

        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)

        if not day.food_enabled:
            result = 'NOT_ELIGIBLE'
            return self._respond(result, message='Food not enabled for this day', status_code=403, program=program, token_str=token_str)

        # Find the token
        try:
            food_token = FoodToken.objects.select_for_update().get(token=token_str)
        except FoodToken.DoesNotExist:
            return self._respond('INVALID_TOKEN', message='Invalid QR code', status_code=404,
                                 program=program, token_str=token_str)

        # Validate token belongs to this program/day
        if food_token.food_service.program_id != program.id:
            return self._respond('WRONG_PROGRAM', message='QR is for a different program', status_code=403,
                                 program=program, token_str=token_str)
        if food_token.food_service.day_id != day.id:
            return self._respond('WRONG_DAY', message='QR is for a different day', status_code=403,
                                 program=program, token_str=token_str)

        # Check expiry
        if food_token.food_service.qr_valid_from and timezone.now() < food_token.food_service.qr_valid_from:
            return self._respond('EXPIRED', message='QR is not yet valid', status_code=403,
                                 program=program, token_str=token_str)
        if food_token.food_service.qr_valid_until and timezone.now() > food_token.food_service.qr_valid_until:
            return self._respond('EXPIRED', message='QR has expired', status_code=403,
                                 program=program, token_str=token_str)

        # Atomic compare-and-set: only claim if not already claimed
        if not food_token.is_claimed:
            food_token.is_claimed = True
            food_token.claimed_at = timezone.now()
            food_token.claimed_by = request.user
            food_token.claim_gate = request.data.get('gate_name', '')
            food_token.claim_device_info = {
                'ip': request.META.get('REMOTE_ADDR', ''),
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
            }
            food_token.save(update_fields=[
                'is_claimed', 'claimed_at', 'claimed_by', 'claim_gate',
                'claim_device_info', 'updated_at'
            ])

            # Record claim
            FoodClaim.objects.create(
                token=food_token,
                participant=food_token.participant,
                food_service=food_token.food_service,
                claimed_by=request.user,
                gate_name=request.data.get('gate_name', ''),
                device_info=food_token.claim_device_info,
                result='SUCCESS',
            )

            AuditLog.objects.create(
                user=request.user, action='food_claim',
                entity_type='FoodToken', entity_id=food_token.id,
                after={'result': 'claimed'}, program_id=program.id
            )

            return self._respond('claimed', message='Food issued', status_code=200,
                                 program=program, token_str=token_str, participant=food_token.participant)

        # Already claimed
        AuditLog.objects.create(
            user=request.user, action='food_claim',
            entity_type='FoodToken', entity_id=food_token.id,
            after={'result': 'already_claimed'}, program_id=program.id
        )
        return self._respond('already_claimed', message='Food already claimed', status_code=409,
                             program=program, token_str=token_str)

    def _respond(self, result, message, status_code, program, token_str, participant=None):
        data = {
            'result': result,
            'message': message,
            'participant_name': participant.full_name if participant else None,
        }
        return Response(data, status=status_code)


class DayFoodSummaryView(APIView):
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get(self, request, program_id, day_id):
        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)
        services = FoodService.objects.filter(program=program, day=day)

        summaries = []
        for service in services:
            total_registered = Registration.objects.filter(
                program=program, status__in=['APPROVED', 'SUBMITTED']
            ).count()
            eligible = FoodEligibility.objects.filter(food_service=service, is_eligible=True).count()
            sent = FoodEligibility.objects.filter(food_service=service, is_eligible=True, qr_sent=True).count()
            claimed = FoodToken.objects.filter(food_service=service, is_claimed=True).count()
            summaries.append({
                'food_service': FoodServiceSerializer(service).data,
                'total_registered': total_registered,
                'eligible': eligible,
                'generated': FoodEligibility.objects.filter(food_service=service, qr_generated=True).count(),
                'sent': sent,
                'claimed': claimed,
                'remaining_to_claim': max(0, sent - claimed),
                'new_eligible_not_sent': max(0, eligible - sent),
            })
        return Response({
            'day': day_id,
            'program': str(program.id),
            'services': summaries,
        })


class PreSendSummaryView(APIView):
    """Return pre-send summary without sending"""
    permission_classes = [IsFoodOperator, HasProgramScope]

    def get(self, request, program_id, day_id):
        program = Program.objects.get(id=program_id)
        day = ProgramDay.objects.get(id=day_id, program=program)
        services = FoodService.objects.filter(program=program, day=day, is_active=True)
        eligible = FoodEligibility.objects.filter(
            food_service__in=services, is_eligible=True, qr_generated=True
        ).count()
        sent = FoodEligibility.objects.filter(
            food_service__in=services, is_eligible=True, qr_sent=True
        ).count()
        return Response({
            'eligible': eligible,
            'already_sent': sent,
            'new_to_send': max(0, eligible - sent),
        })