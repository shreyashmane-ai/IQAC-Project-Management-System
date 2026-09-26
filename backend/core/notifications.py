"""
Core notification helpers (email).

Email is sent through Django's configured EMAIL_BACKEND (respecting the user's
"real SMTP send" choice). If sending fails for any reason (backend not
configured/credential errors, etc.), the message is logged to the console/system
logger and a printable preview is returned, so the feature remains testable
("print/simulate") and never breaks the registration flow.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


def _public_site_url():
    return getattr(settings, 'PUBLIC_SITE_URL', '').rstrip('/')


def _public_my_qrs_url():
    base = _public_site_url()
    return f"{base}/my-qrs" if base else ''


def build_confirmation_context(registration):
    program = registration.program
    participant = registration.participant
    return {
        'full_name': participant.full_name,
        'email': participant.email,
        'registration_number': registration.registration_number,
        'status': registration.get_status_display(),
        'program_title': program.title,
        'program_short_code': program.short_code,
        'program_venue': program.venue or '',
        'my_qrs_url': _public_my_qrs_url(),
    }


def _build_message(registration):
    ctx = build_confirmation_context(registration)
    subject = (
        f"Registration confirmed: {ctx['program_short_code']} - {ctx['program_title']}"
    )
    body = (
        f"Dear {ctx['full_name']},\n\n"
        f"Your registration is confirmed.\n\n"
        f"Program    : {ctx['program_title']} ({ctx['program_short_code']})\n"
        f"Registration No. : {ctx['registration_number']}\n"
        f"Status     : {ctx['status']}\n"
        f"Venue      : {ctx['program_venue'] or '—'}\n\n"
        f"To view your scannable attendance and food QR codes, visit:\n"
        f"{ctx['my_qrs_url']}\n\n"
        f"Enter your registration number and email address to access them.\n\n"
        f"Thank you,\nIQAC PMS"
    )
    return subject, body


def send_confirmation_email(registration, request=None):
    """Send a registration confirmation email.

    Sets `confirmation_sent`/`confirmation_sent_at` on success. On any failure,
    logs a preview of the email and returns the recipient address (no exception
    is raised) so the surrounding flow is never broken.
    """
    subject, body = _build_message(registration)
    recipient = [registration.participant.email]

    try:
        send_mail(subject, body, None, recipient, fail_silently=False)
        sent = True
    except Exception as exc:  # noqa: BLE001 - intentionally never break the flow
        sent = False
        preview = (
            f"To: {recipient[0]}\nSubject: {subject}\n\n{body}"
        )
        logger.warning(
            "Confirmation email NOT sent to %s (%s)\n%s",
            recipient[0], exc, preview,
        )
        preview = f"From: IQAC PMS <noreply@university.edu>\nTo: {recipient[0]}\nSubject: {subject}\n\n{body}"
        if request is not None:
            request._confirmation_email_preview = preview  # attach for tests/debug

    if sent:
        registration.confirmation_sent = True
        registration.confirmation_sent_at = timezone.now()
        registration.save(update_fields=['confirmation_sent', 'confirmation_sent_at'])

    return sent
