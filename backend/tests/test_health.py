"""
Health endpoint smoke test.

Requires a reachable database and a running Redis on REDIS_URL /
CELERY_BROKER_URL (the CI workflow provides both as service containers).
"""
from django.test import TestCase
from rest_framework.test import APIClient


class HealthCheckTests(TestCase):
    def test_health_returns_ok(self):
        resp = APIClient().get("/api/v1/health/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "ok")
        self.assertEqual(
            resp.data["checks"],
            {"database": "ok", "cache": "ok", "celery_broker": "ok"},
        )