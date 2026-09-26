"""
Custom exception handler for consistent error responses
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from django.core.exceptions import ValidationError as DjangoValidationError


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    
    if response is not None:
        # Standardize error format
        error_data = {
            'error': {
                'code': response.status_code,
                'message': 'An error occurred',
                'fieldErrors': {},
            }
        }
        
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                error_data['error']['message'] = str(response.data['detail'])
            elif 'non_field_errors' in response.data:
                error_data['error']['message'] = str(response.data['non_field_errors'][0])
            else:
                # Field-level errors
                error_data['error']['fieldErrors'] = response.data
                error_data['error']['message'] = 'Validation failed'
        elif isinstance(response.data, list):
            error_data['error']['message'] = str(response.data[0])
        
        # Map status codes to codes
        code_map = {
            400: 'VALIDATION_ERROR',
            401: 'UNAUTHENTICATED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            429: 'RATE_LIMITED',
        }
        error_data['error']['code'] = code_map.get(response.status_code, 'ERROR')
        
        response.data = error_data
    
    elif isinstance(exc, IntegrityError):
        # Database constraint violations
        response = Response({
            'error': {
                'code': 'CONFLICT',
                'message': 'Duplicate entry or constraint violation',
                'fieldErrors': {},
            }
        }, status=status.HTTP_409_CONFLICT)
    
    elif isinstance(exc, DjangoValidationError):
        response = Response({
            'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Validation failed',
                'fieldErrors': exc.message_dict if hasattr(exc, 'message_dict') else {'non_field': exc.messages},
            }
        }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
    
    return response