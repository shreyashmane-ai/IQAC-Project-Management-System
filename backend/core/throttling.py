"""
Rate throttles for public / anonymous / high-traffic endpoints.

Rates are defined in config.settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
and applied by scope below:

    class PublicRegistrationView(APIView):
        throttle_classes = [PublicRegisterThrottle]

Counters live in the default cache, which is Redis (settings.CACHES), so rate
limits are shared across every web worker/process instead of being per-process
in-memory. If Redis is unavailable, settings.CACHES IGNORE_EXCEPTIONS makes the
cache return None and throttling degrades to allow (no 5xx).

Note: these were previously ScopedRateThrottle subclasses, which read the
view's `throttle_scope` attribute (unset on every view here) and therefore
never throttled anything. SimpleRateThrottle bases below actually enforce the
declared rates, keyed by client IP.
"""
from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class IpRateThrottle(SimpleRateThrottle):
    """Rate limit by client IP regardless of authentication state.

    Used for anonymous public endpoints and pre-auth flows (login/OTP) where
    there is no logged-in user yet.
    """

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class PublicRegisterThrottle(IpRateThrottle):
    scope = 'public_register'


class PublicFeedbackThrottle(IpRateThrottle):
    scope = 'public_feedback'


class PublicVerifyThrottle(IpRateThrottle):
    scope = 'public_verify'


class PublicReadThrottle(IpRateThrottle):
    scope = 'public_read'


class OperatorScanThrottle(IpRateThrottle):
    scope = 'operator_scan'


class AuthLoginThrottle(IpRateThrottle):
    scope = 'auth_login'


class AuthOtpThrottle(IpRateThrottle):
    scope = 'auth_otp'


class AuthUserThrottle(UserRateThrottle):
    scope = 'auth_user'