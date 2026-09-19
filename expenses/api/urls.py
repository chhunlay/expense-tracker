from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

from .views import (
    AssetViewSet,
    CategoryViewSet,
    TransactionViewSet,
    export_csv,
    export_xlsx,
    import_transactions,
    profile,
    register,
    reports,
    summary,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="api-category")
router.register("transactions", TransactionViewSet, basename="api-transaction")
router.register("assets", AssetViewSet, basename="api-asset")

urlpatterns = router.urls + [
    # POST {"username", "password"} here to get a token for
    # TokenAuthentication (mobile apps / scripts) instead of relying on
    # the session cookie the browser already has after /login.
    path("token/", obtain_auth_token, name="api-token"),
    # POST {"username", "password"} to create an account (seeds default
    # categories, same as the HTML /register form) and get a token back.
    path("register/", register, name="api-register"),
    # GET ?month=YYYY-MM (defaults to current month) - income/expense/
    # net/net_worth, the numbers the Next.js dashboard needs in one call.
    path("summary/", summary, name="api-summary"),
    # GET/PATCH the signed-in user's own Profile (theme, language,
    # picture) - a singleton, so no id in the URL.
    path("profile/", profile, name="api-profile"),
    # GET the Reports page's 12-month trend + top-spending-categories.
    path("reports/", reports, name="api-reports"),
    # GET a full transaction-history export; POST (multipart, field
    # "file") a .csv/.xlsx to import.
    path("export/csv/", export_csv, name="api-export-csv"),
    path("export/xlsx/", export_xlsx, name="api-export-xlsx"),
    path("import/", import_transactions, name="api-import"),
]
