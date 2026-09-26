"""
Shared model factories for the IQAC PMS test suite.
"""
import os
import uuid
from datetime import date, time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.contrib.auth import get_user_model  # noqa: E402

from core.models_user import Role  # noqa: E402
from programs.models import (  # noqa: E402
    AcademicSession,
    Program,
    ProgramAssignment,
    ProgramType,
)

User = get_user_model()


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _allow_testserver(settings):
    """Django test client uses HTTP_HOST=testserver; permit it in tests."""
    settings.ALLOWED_HOSTS = ["*"]


def make_user(role=Role.PROGRAM_COORDINATOR, prefix="user", **kwargs):
    """Create a staff user with a unique username/email."""
    uniq = uuid.uuid4().hex[:8]
    data = {
        "username": f"{prefix}-{uniq}",
        "email": f"{prefix}-{uniq}@example.com",
        "password": "testpass123",
        "first_name": "Test",
        "last_name": prefix.title(),
    }
    data.update(kwargs)
    return User.objects.create_user(role=role, **data)


def make_session(code=None):
    if code is None:
        code = f"AY-{uuid.uuid4().hex[:6]}"
    return AcademicSession.objects.create(
        code=code,
        name=f"Academic Session {code}",
        start_date=date(2026, 4, 1),
        end_date=date(2027, 3, 31),
        is_active=True,
    )


def make_program_type(code=None):
    if code is None:
        code = f"PT-{uuid.uuid4().hex[:6]}"
    return ProgramType.objects.create(code=code, name=f"Type {code}")


def make_program(coordinator=None, **kwargs):
    """Create a fully-populated Program with a unique short_code."""
    coordinator = coordinator or make_user(role=Role.PROGRAM_ADMIN)
    data = {
        "title": "Test FDP",
        "short_code": f"TF-{uuid.uuid4().hex[:6]}",
        "academic_session": make_session(),
        "program_type": make_program_type(),
        "program_coordinator": coordinator,
        "start_date": date(2026, 8, 10),
        "end_date": date(2026, 8, 11),
        "start_time": time(9, 0),
        "end_time": time(17, 0),
        "status": Program.Status.REGISTRATION_OPEN,
        "registration_link_enabled": True,
    }
    data.update(kwargs)
    return Program.objects.create(**data)


def assign(user, program):
    """Link a user to a program (active assignment)."""
    return ProgramAssignment.objects.create(user=user, program=program)