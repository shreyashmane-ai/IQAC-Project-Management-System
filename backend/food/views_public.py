"""
Food public views (operator claim scan)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils import timezone

from .models import FoodService, FoodEligibility, FoodToken, FoodClaim
from programs.models import Program, ProgramDay
from core.models_user import AuditLog
from core.permissions import IsFoodOperator
from core.throttling import OperatorScanThrottle


class FoodClaimScanView(APIView):
    """Public scan endpoint for claiming food via QR"""
    permission_classes = [IsFoodOperator]
    throttle_classes = [OperatorScanThrottle]

    @transaction.atomic
    def post(self, request):
        token_str = (request.data.get('token') or '').strip()
        service_id = request.data.get('food_service_id') or request.data.get('service_id')
        day_id = request.data.get('day_id')
        gate_name = request.data.get('gate_name', '')

        if not token_str:
            return Response({'error': {'code': 'VALIDATION', 'message': 'token required'}},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            food_token = FoodToken.objects.select_related(
                'food_service', 'food_service__day', 'participant'
            ).select_for_update().get(token=token_str)
        except FoodToken.DoesNotExist:
            return self._claim_response('INVALID_TOKEN', 'Invalid QR code', 404)

        service = food_token.food_service
        program = service.program

        # Day/service validation
        if day_id and str(day_id) != str(service.day_id):
            return self._claim_response('WRONG_DAY', 'QR is for a different day', 403)
        if service_id and str(service_id) != str(service.id):
            return self._claim_response('WRONG_SERVICE', 'QR is for a different service', 403)

        if not service.is_active:
            return self._claim_response('INVALID_TOKEN', 'Service is inactive', 403)

        # Expiry window
        now = timezone.now()
        if service.qr_valid_from and now < service.qr_valid_from:
            return self._claim_response('EXPIRED', 'QR is not yet valid', 403)
        if service.qr_valid_until and now > service.qr_valid_until:
            return self._claim_response('EXPIRED', 'QR has expired', 403)

        # Atomic single-use claim
        if food_token.is_claimed:
            return self._claim_response('ALREADY_CLAIMED', 'QR already used', 409)

        food_token.is_claimed = True
        food_token.claimed_at = now
        food_token.claimed_by = request.user
        food_token.claim_gate = gate_name
        food_token.claim_device_info = {
            'ip': request.META.get('REMOTE_ADDR', ''),
            'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
        }
        food_token.save(update_fields=[
            'is_claimed', 'claimed_at', 'claimed_by', 'claim_gate', 'claim_device_info', 'updated_at'
        ])

        FoodClaim.objects.create(
            token=food_token,
            participant=food_token.participant,
            food_service=service,
            claimed_by=request.user,
            gate_name=gate_name,
            device_info=food_token.claim_device_info,
            result='SUCCESS',
        )

        AuditLog.objects.create(
            user=request.user, action='food_claim_scan',
            entity_type='FoodToken', entity_id=food_token.id,
            after={'result': 'claimed'}, program_id=program.id
        )

        return Response({
            'result': 'SUCCESS',
            'message': 'Food issued',
            'participant_name': food_token.participant.full_name,
            'service': service.get_service_type_display(),
        })

    def _claim_response(self, result, message, status_code):
        return Response({'result': result, 'message': message}, status=status_code)