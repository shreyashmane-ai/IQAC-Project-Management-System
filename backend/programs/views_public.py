"""
Programs public views (public registration page)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.core.cache import cache

from .models import Program, ProgramDay
from core.models_user import User
from core.throttling import PublicReadThrottle


PROGRAM_CACHE_TTL = 300  # seconds; invalidated on Program/ProgramDay save via programs.signals


class PublicProgramView(APIView):
    """Public program details via public token"""
    permission_classes = []
    throttle_classes = [PublicReadThrottle]

    def get(self, request, token):
        key = f'public:program:{token}'
        data = cache.get(key)
        if data is not None:
            return Response(data)

        try:
            program = Program.objects.select_related('academic_session').get(
                public_token=token,
            )
        except Program.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Program not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        # Basic info
        data = {
            'id': str(program.id),
            'title': program.title,
            'short_code': program.short_code,
            'description': program.description,
            'program_type': program.program_type.name,
            'start_date': program.start_date,
            'end_date': program.end_date,
            'registration_status': program.status,
            'status_display': program.get_status_display(),
            'venue': program.venue_details or (program.venue.name if program.venue else ''),
            'coordinator': {
                'id': str(program.program_coordinator.id),
                'name': program.program_coordinator.get_full_name(),
                'email': program.program_coordinator.email,
            } if program.program_coordinator_id else None,
        }
        cache.set(key, data, timeout=PROGRAM_CACHE_TTL)
        return Response(data)


class PublicProgramDaysView(APIView):
    """Public program schedule (non-PII)"""
    permission_classes = []
    throttle_classes = [PublicReadThrottle]

    def get(self, request, token):
        key = f'public:program:{token}:days'
        days_data = cache.get(key)
        if days_data is not None:
            return Response(days_data)

        try:
            program = Program.objects.get(public_token=token)
        except Program.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Program not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        days = program.days.filter(is_cancelled=False).order_by('day_number')
        days_data = [
            {
                'id': str(d.id),
                'day_number': d.day_number,
                'date': d.date,
                'start_time': d.start_time,
                'end_time': d.end_time,
                'title': d.title,
                'venue': program.venue_details or (program.venue.name if program.venue else ''),
            }
            for d in days
        ]
        cache.set(key, days_data, timeout=PROGRAM_CACHE_TTL)
        return Response(days_data)