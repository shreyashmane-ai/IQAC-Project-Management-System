"""
Public program detail caching tests: cache populate on first read and
invalidation on Program.save() via programs.signals.
"""
from django.conf import settings
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from programs.models import Program

from .conftest import make_program

_FAST_THROTTLES = {
    **settings.REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "public_read": "10000/min",
    },
}


@override_settings(REST_FRAMEWORK=_FAST_THROTTLES)
class PublicProgramCacheTests(TestCase):
    def setUp(self):
        self.program = make_program(status=Program.Status.REGISTRATION_OPEN)
        self.token = self.program.public_token
        self.url = f"/api/v1/public/p/{self.token}/"
        cache.clear()

    def test_first_request_populates_cache(self):
        resp = APIClient().get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertIsNotNone(cache.get(f"public:program:{self.token}"))

    def test_second_request_served_without_cache_clear(self):
        client = APIClient()
        self.assertEqual(client.get(self.url).status_code, 200)
        self.assertEqual(client.get(self.url).status_code, 200)

    def test_program_save_invalidates_cache(self):
        APIClient().get(self.url)
        self.assertIsNotNone(cache.get(f"public:program:{self.token}"))
        self.program.title = "Renamed Program"
        self.program.save()
        self.assertIsNone(cache.get(f"public:program:{self.token}"))