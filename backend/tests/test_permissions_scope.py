"""
Regression tests for core.permissions.HasProgramScope.

Current fail-open spots (documented in docs/COMPLIANCE-DPDP.md) are pinned with
strict xfail markers: the moment the permission is made fail-closed those tests
start failing loudly so the markers can be removed and CI stays honest.
"""
from types import SimpleNamespace

import pytest
from django.test import TestCase
from rest_framework.views import APIView

from core.models_user import Role
from core.permissions import HasProgramScope

from .conftest import assign, make_program, make_user


class _ScopeView(APIView):
    permission_classes = [HasProgramScope]
    kwargs = {}


def _request(user=None):
    return SimpleNamespace(user=user)


def _permission(user, program_id=None, obj=None):
    view = _ScopeView()
    view.kwargs = {"program_id": str(program_id)} if program_id is not None else {}
    request = _request(user)
    perm = HasProgramScope()
    if obj is not None:
        return perm.has_object_permission(request, view, obj)
    return perm.has_permission(request, view)


class HasProgramScopePermissionTests(TestCase):
    def test_anonymous_denied(self):
        self.assertFalse(_permission(None))

    def test_program_admin_allowed_for_any_program(self):
        admin = make_user(role=Role.PROGRAM_ADMIN)
        program = make_program()
        self.assertTrue(_permission(admin, program_id=program.id))

    def test_coordinator_allowed_for_assigned_program(self):
        program = make_program()
        coordinator = make_user(role=Role.PROGRAM_COORDINATOR)
        assign(coordinator, program)
        self.assertTrue(_permission(coordinator, program_id=program.id))

    def test_coordinator_denied_for_unassigned_program(self):
        assigned = make_program()
        other = make_program()
        coordinator = make_user(role=Role.PROGRAM_COORDINATOR)
        assign(coordinator, assigned)
        self.assertFalse(_permission(coordinator, program_id=other.id))

    @pytest.mark.xfail(
        strict=True,
        reason="fail-open: allow when no program_id is present in view kwargs",
    )
    def test_coordinator_no_program_id_should_deny(self):
        coordinator = make_user(role=Role.PROGRAM_COORDINATOR)
        make_program()
        self.assertFalse(_permission(coordinator))

    @pytest.mark.xfail(
        strict=True,
        reason="fail-open: allow when obj has no program relation",
    )
    def test_object_without_program_should_deny(self):
        coordinator = make_user(role=Role.PROGRAM_COORDINATOR)
        self.assertFalse(_permission(coordinator, obj=SimpleNamespace()))

    def test_object_with_unassigned_program_denied(self):
        program = make_program()
        coordinator = make_user(role=Role.PROGRAM_COORDINATOR)
        obj = SimpleNamespace(program=program)
        self.assertFalse(_permission(coordinator, obj=obj))