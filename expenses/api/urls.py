from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

from .views import AssetViewSet, CategoryViewSet, TransactionViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="api-category")
router.register("transactions", TransactionViewSet, basename="api-transaction")
router.register("assets", AssetViewSet, basename="api-asset")

urlpatterns = router.urls + [
    # POST {"username", "password"} here to get a token for
    # TokenAuthentication (mobile apps / scripts) instead of relying on
    # the session cookie the browser already has after /login.
    path("token/", obtain_auth_token, name="api-token"),
]
