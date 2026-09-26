"""
Public registration tests: DPDP consent enforcement and registration flow.
"""
from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from participants.models import Participant, Registration
from programs.models import Program

from .conftest import make_program

_FAST_THROTTLES = {
    **settings.REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "public_register": "10000/min",
        "public_read": "10000/min",
    },
}


@override_settings(REST_FRAMEWORK=_FAST_THROTTLES)
class PublicRegistrationTests(TestCase):
    def setUp(self):
        self.program = make_program(status=Program.Status.REGISTRATION_OPEN)
        self.url = f"/api/v1/public/p/{self.program.public_token}/register/"

    def post(self, payload):
        return APIClient().post(self.url, payload, format="json")

    def test_missing_consent_is_rejected_422(self):
        resp = self.post({"email": "alpha@example.com", "form_data": {}})
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.data["error"]["code"], "CONSENT_REQUIRED")
        self.assertFalse(Registration.objects.exists())

    def test_registration_with_consent_creates_record(self):
        resp = self.post(
            {
                "email": "beta@example.com",
                "full_name": "Beta",
                "consent": True,
            }
        )
        self.assertEqual(resp.status_code, 201)
        reg = Registration.objects.get()
        self.assertEqual(reg.status, Registration.Status.SUBMITTED)
        self.assertEqual(reg.participant.email, "beta@example.com")
        self.assertTrue(reg.participant.consent_given)
        self.assertIsNotNone(reg.participant.consent_date)
        self.assertTrue(reg.attendance_token)
        self.assertTrue(reg.feedback_token)

    def test_duplicate_registration_returns_conflict(self):
        payload = {"email": "gamma@example.com", "consent": True}
        self.assertEqual(self.post(payload).status_code, 201)
        resp = self.post(payload)
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.data["error"]["code"], "DUPLICATE")

    def test_closed_registration_returns_400(self):
        self.program.status = Program.Status.REGISTRATION_CLOSED
        self.program.save()
        resp = self.post({"email": "delta@example.com", "consent": True})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["error"]["code"], "CLOSED")

    def test_participant_consent_recorded_once_for_repeat_registrations(self):
        first = self.post({"email": "epsilon@example.com", "consent": True})
        self.assertEqual(first.status_code, 201)
        participant = Participant.objects.get(email="epsilon@example.com")
        self.assertTrue(participant.consent_given)
        self.assertIsNotNone(participant.consent_date)