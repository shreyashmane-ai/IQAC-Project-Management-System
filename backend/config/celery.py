"""
Celery configuration for IQAC PMS
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('iqac_pms')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Task queues
app.conf.task_routes = {
    'notifications.tasks.send_email': {'queue': 'emails'},
    'notifications.tasks.send_bulk': {'queue': 'emails'},
    'certificates.tasks.generate_certificate': {'queue': 'certificates'},
    'certificates.tasks.generate_bulk': {'queue': 'certificates'},
    'certificates.tasks.send_certificate': {'queue': 'certificates'},
    'reports.tasks.generate_export': {'queue': 'reports'},
    'food.tasks.generate_qr': {'queue': 'food'},
    'food.tasks.send_qr': {'queue': 'food'},
    'documents.tasks.generate_artifact': {'queue': 'documents'},
}

# Worker configuration
app.conf.update(
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_priority=5,
    task_queue_max_priority=10,
)

# Beat schedule (periodic tasks)
app.conf.beat_schedule = {
    # Cleanup expired tokens daily at 2 AM
    'cleanup-expired-tokens': {
        'task': 'core.tasks.cleanup_expired_tokens',
        'schedule': crontab(hour=2, minute=0),
    },
    # Update food summaries every 5 minutes during active hours
    'update-food-summaries': {
        'task': 'food.tasks.update_all_summaries',
        'schedule': 300.0,  # 5 minutes
    },
    # Update feedback analytics hourly
    'update-feedback-analytics': {
        'task': 'feedback.tasks.update_all_analytics',
        'schedule': crontab(minute=0),
    },
    # Send pending notifications every minute
    'process-pending-notifications': {
        'task': 'notifications.tasks.process_pending',
        'schedule': 60.0,
    },
    # Retry failed notifications every 10 minutes
    'retry-failed-notifications': {
        'task': 'notifications.tasks.retry_failed',
        'schedule': 600.0,
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')