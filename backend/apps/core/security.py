"""
Auth for the Ninja API - a from-scratch equivalent of Django REST
Framework's TokenAuthentication, since the API no longer depends on
DRF at all. The Next.js frontend already sends
"Authorization: Token <key>" (lib/api.ts), so this parses that exact
header shape rather than Ninja's own HttpBearer default ("Bearer ..."),
to avoid changing the frontend.
"""
from ninja.security import APIKeyHeader

from .models import AuthToken


class TokenAuth(APIKeyHeader):
    param_name = "Authorization"

    def authenticate(self, request, key: str | None):
        if not key or not key.startswith("Token "):
            return None
        token_key = key[len("Token "):].strip()
        try:
            token = AuthToken.objects.select_related("user").get(key=token_key)
        except AuthToken.DoesNotExist:
            return None
        request.user = token.user
        return token.user
