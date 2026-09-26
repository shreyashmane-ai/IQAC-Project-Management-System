"""
Participants public views (public registration)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.db import IntegrityError
from django.utils import timezone
from django.core.cache import cache

from .models import Participant, Registration
from programs.models import Program
from core.throttling import PublicRegisterThrottle
from core.notifications import send_confirmation_email


FORM_CACHE_TTL = 120  # seconds; invalidated on Program save via programs.signals


class PublicRegistrationView(APIView):
    """Public registration for a program"""
    permission_classes = []
    throttle_classes = [PublicRegisterThrottle]

    def get(self, request, token):
        key = f'public:program:{token}:form'
        data = cache.get(key)
        if data is not None:
            return Response(data)

        try:
            program = Program.objects.get(public_token=token)
        except Program.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Program not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        # Return registration form schema / fields
        data = {
            'program': {
                'id': str(program.id), 'title': program.title, 'short_code': program.short_code,
            },
            'registration_open': (
                program.status in ['REG_OPEN', 'PUBLISHED']
                and program.registration_link_enabled
            ),
            'registration_schema': program.registration_schema or {},
        }
        cache.set(key, data, timeout=FORM_CACHE_TTL)
        return Response(data)

    @transaction.atomic
    def post(self, request, token):
        try:
            program = Program.objects.select_for_update().get(public_token=token)
        except Program.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Program not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        is_open = (
            program.status in ['REG_OPEN', 'PUBLISHED']
            and program.registration_link_enabled
        )
        if not is_open:
            return Response({'error': {'code': 'CLOSED', 'message': 'Registration is closed'}},
                            status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        form_data = data.get('form_data', {}) or {}

        def first_choice(*keys):
            for k in keys:
                v = (data.get(k) or form_data.get(k) or '')
                if isinstance(v, str) and v.strip():
                    return v.strip()
            return ''

        # Identity fields may be sent top-level or inside form_data. The dynamic
        # form keys fields by their schema `name`, which is frequently a human
        # label (e.g. "Contact No.", "Full Name"), so also match by scanning the
        # schema fields for email/phone/name by type or normalized label.
        schema_fields = ((program.registration_schema or {}).get('fields') or [])

        def norm(s):
            return (s or '').lower().replace(' ', '').replace('.', '').replace('_', '')

        def from_schema(field_type, *label_terms):
            for f in schema_fields:
                ftype = (f.get('type') or '').lower()
                fname = f.get('name') or ''
                flabel = norm(f.get('label') or fname)
                if ftype == field_type or any(term in flabel for term in label_terms):
                    v = form_data.get(fname)
                    if isinstance(v, str) and v.strip():
                        return v.strip()
            return ''

        email = first_choice('email') or from_schema('email', 'email')
        mobile = first_choice('mobile', 'phone', 'contact_number') or from_schema('phone', 'contact', 'mobile', 'phone')
        full_name = first_choice('full_name', 'name', 'participant_name') or from_schema(None, 'fullname', 'participantname', 'name')
        institution = first_choice('institution', 'college', 'organization') or from_schema(None, 'institution', 'college', 'organization')

        if not email and not mobile:
            return Response({'error': {'code': 'VALIDATION', 'message': 'Email or mobile required'}},
                            status=status.HTTP_400_BAD_REQUEST)

        # DPDP-compliant consent: registration is not possible without explicit
        # consent to process the submitted information (BE-CONSENT-01).
        if not bool(data.get('consent')):
            return Response({'error': {'code': 'CONSENT_REQUIRED',
                                       'message': 'Please accept the privacy policy to register.'}},
                            status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Server-side validation of the dynamic form against the program schema (BE-FORM-03)
        from core.form_validation import validate_form_submission
        errors = validate_form_submission(program.registration_schema or {}, form_data)
        if errors:
            field_errors = {}
            for fname, message in errors:
                field_errors.setdefault(fname, message)
            return Response({'error': {'code': 'VALIDATION_ERROR',
                                       'message': 'Please correct the highlighted fields.',
                                       'fieldErrors': field_errors}},
                            status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Find existing participant by email/mobile
        participant = None
        try:
            participant = Participant.objects.get(email=email)
        except Participant.DoesNotExist:
            try:
                if mobile:
                    participant = Participant.objects.filter(mobile=mobile).first()
            except Exception:
                participant = None

        if not participant:
            participant = Participant.objects.create(
                email=email,
                mobile=mobile,
                full_name=full_name or data.get('full_name', '').strip(),
                institution=institution or data.get('institution', ''),
                institution_department=data.get('institution_department', ''),
                institution_designation=data.get('institution_designation', ''),
                city=data.get('city', ''),
                state=data.get('state', ''),
                country=data.get('country', 'India'),
                extra_data=data.get('extra_data', {}),
                consent_given=True,
                consent_date=timezone.now(),
            )

        # Dedup + capacity, both atomic inside this transaction (BE-REG-02/03).
        # The [program, participant] unique constraint is the authoritative guard;
        # catching IntegrityError closes the concurrent-submission race.
        existing = Registration.objects.filter(program=program, participant=participant).first()
        if existing:
            if existing.status in [Registration.Status.CANCELLED, Registration.Status.REJECTED]:
                existing.delete()
            else:
                return Response({
                    'error': {'code': 'DUPLICATE', 'message': 'Already registered'},
                    'registration_number': existing.registration_number,
                    'status': existing.status,
                }, status=status.HTTP_409_CONFLICT)

        # Lock the program row so two concurrent registrations can't overshoot capacity.
        program = Program.objects.select_for_update().get(pk=program.pk)
        approved_count = Registration.objects.filter(
            program=program, status__in=['APPROVED', 'SUBMITTED']
        ).count()
        capacity = program.max_participants
        if capacity and approved_count >= capacity:
            reg_status = Registration.Status.WAITLISTED
        else:
            reg_status = Registration.Status.SUBMITTED

        try:
            registration = Registration.objects.create(
                program=program,
                participant=participant,
                form_data=form_data,
                form_schema_version=program.registration_schema or {},
                identity_key_values={'email': email, 'mobile': mobile},
                status=reg_status,
            )
        except IntegrityError:
            # Concurrent duplicate (unique [program, participant]) -> friendly conflict
            transaction.set_rollback(True)
            existing = Registration.objects.filter(program=program, participant=participant).first()
            if existing:
                return Response({
                    'error': {'code': 'DUPLICATE', 'message': 'Already registered'},
                    'registration_number': existing.registration_number,
                    'status': existing.status,
                }, status=status.HTTP_409_CONFLICT)
            raise

        # Send registration confirmation email (sets confirmation_sent on success;
        # never breaks the registration flow).
        confirmed = send_confirmation_email(registration, request)

        payload = {
            'registration_number': registration.registration_number,
            'status': registration.status,
            'attendance_token': registration.attendance_token,
            'feedback_token': registration.feedback_token,
            'message': 'Registered successfully',
            'confirmation_sent': confirmed,
        }
        preview = getattr(request, '_confirmation_email_preview', None)
        if preview:
            payload['confirmation_email'] = preview

        return Response(payload, status=status.HTTP_201_CREATED)


class PublicQRsView(APIView):
    """Self-service: enter registration number + email to view all QR codes.

    Returns scannable QR images (base64 PNG) for every registration that
    matches BOTH the registration number and email (case-insensitive).
    Food claim tokens are looked up via Registration → FoodEligibility → FoodToken.
    """
    permission_classes = []
    throttle_classes = [PublicRegisterThrottle]

    def _qr_b64(self, text):
        import qrcode
        import io
        import base64 as b64
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return b64.b64encode(buf.getvalue()).decode()

    def post(self, request):
        reg_no = (request.data.get('registration_number') or '').strip()
        email = (request.data.get('email') or '').strip()

        if not reg_no or not email:
            return Response(
                {'error': {'code': 'VALIDATION', 'message': 'registration_number and email are required'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        regs = list(
            Registration.objects.filter(
                registration_number__iexact=reg_no,
                participant__email__iexact=email,
            ).select_related('program', 'participant').order_by('program__title')
        )

        if not regs:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'No matching registration. Please check your registration number and email.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        programs = []
        for reg in regs:
            food_qrs = []
            eligs = reg.food_eligibilities.select_related(
                'food_service', 'food_service__day', 'token'
            ).all()
            for elig in eligs:
                token_obj = getattr(elig, 'token', None)
                if token_obj is None:
                    continue
                svc = elig.food_service
                day = svc.day
                if not svc.is_active:
                    continue
                if day is not None and not day.food_enabled:
                    continue
                food_qrs.append({
                    'id': str(token_obj.id),
                    'service': svc.get_service_type_display(),
                    'service_name': svc.name or '',
                    'day_number': day.day_number if day else None,
                    'day_date': day.date.strftime('%Y-%m-%d') if day and day.date else None,
                    'is_claimed': token_obj.is_claimed,
                    'qr': self._qr_b64(token_obj.token),
                })
            att_days = reg.program.days.filter(
                attendance_enabled=True
            ).order_by('day_number')
            attendance_qrs = [
                {
                    'day_number': d.day_number,
                    'day_date': d.date.strftime('%Y-%m-%d') if d.date else None,
                    'qr': self._qr_b64(reg.attendance_token),
                }
                for d in att_days
            ] if reg.attendance_token else []

            programs.append({
                'program_id': str(reg.program.id),
                'program_title': reg.program.title,
                'short_code': reg.program.short_code,
                'registration_number': reg.registration_number,
                'status': reg.status,
                'attendance_qr': attendance_qrs[0]['qr'] if attendance_qrs else None,
                'attendance_token': reg.attendance_token,
                'attendance_qrs': attendance_qrs,
                'food_qrs': food_qrs,
            })

        return Response({
            'participant_name': regs[0].participant.full_name,
            'email': regs[0].participant.email,
            'programs': programs,
        })