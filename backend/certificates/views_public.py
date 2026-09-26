"""
Certificates public views (participant download & public verification)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import FileResponse

from .models import Certificate, CertificateConfig
from core.throttling import PublicVerifyThrottle


class CertificateDownloadView(APIView):
    """Participant downloads their certificate via verification token"""
    permission_classes = []
    throttle_classes = [PublicVerifyThrottle]

    def get(self, request, token):
        try:
            cert = Certificate.objects.select_related(
                'participant', 'program'
            ).get(verification_token=token)
        except Certificate.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Certificate not found'}},
                            status=status.HTTP_404_NOT_FOUND)

        if cert.status == Certificate.Status.CANCELLED:
            return Response({'error': {'code': 'CANCELLED', 'message': 'Certificate has been cancelled'}},
                            status=status.HTTP_410_GONE)

        if cert.pdf_file:
            response = FileResponse(cert.pdf_file.open('rb'), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{cert.certificate_number}.pdf"'
            return response

        return Response({
            'certificate_number': cert.certificate_number,
            'participant_name': cert.participant.full_name,
            'program_title': cert.program.title,
            'status': cert.status,
            'message': 'PDF not yet generated',
        })


class CertificateVerifyView(APIView):
    """Public verification of a certificate by its certificate number"""
    permission_classes = []
    throttle_classes = [PublicVerifyThrottle]

    def get(self, request, number):
        try:
            cert = Certificate.objects.select_related(
                'participant', 'program', 'program__academic_session'
            ).get(certificate_number=number)
        except Certificate.DoesNotExist:
            return Response({
                'certificate_number': number,
                'status': 'NOT_FOUND',
                'valid': False,
            }, status=status.HTTP_404_NOT_FOUND)

        is_valid = cert.is_valid
        return Response({
            'certificate_number': cert.certificate_number,
            'status': cert.status,
            'valid': is_valid,
            'participant_name': cert.participant.full_name if is_valid else None,
            'program_title': cert.program.title if is_valid else None,
            'program_date': (
                f"{cert.program.start_date} - {cert.program.end_date}" if is_valid else None
            ),
            'issued_by': 'IQAC' if is_valid else None,
            'issued_date': cert.created_at.date() if is_valid else None,
        })