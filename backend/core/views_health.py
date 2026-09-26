"""
Health check: reports status of the database, the Redis cache and the Celery
broker so that Redis outages are visible. Returns 200 when every dependency is
healthy and 503 otherwise.
"""
from django.conf import settings
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

try:
    from django_redis import get_redis_connection
except ImportError:  # django-redis not installed -> cache check is unknown
    get_redis_connection = None

try:
    from redis import Redis
except ImportError:
    Redis = None


def _check_cache():
    if get_redis_connection is None:
        return 'unknown'
    try:
        conn = get_redis_connection('default')
        return 'ok' if conn.ping() else 'unavailable'
    except Exception:
        return 'unavailable'


def _check_broker():
    if Redis is None:
        return 'unknown'
    try:
        client = Redis.from_url(
            settings.CELERY_BROKER_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        try:
            return 'ok' if client.ping() else 'unavailable'
        finally:
            client.close()
    except Exception:
        return 'unavailable'


@api_view(['GET'])
@permission_classes([])
def health_check(request):
    checks = {}

    try:
        connection.ensure_connection()
        checks['database'] = 'ok'
    except Exception:
        checks['database'] = 'unavailable'

    checks['cache'] = _check_cache()
    checks['celery_broker'] = _check_broker()

    healthy = all(v == 'ok' for v in checks.values())
    return Response(
        {'status': 'ok' if healthy else 'degraded', 'checks': checks},
        status=200 if healthy else 503,
    )