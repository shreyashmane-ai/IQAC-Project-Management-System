"""
IQAC PMS - Main package init
"""
from .celery import app as celery_app

__all__ = ('celery_app',)