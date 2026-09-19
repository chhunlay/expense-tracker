"""
The one global NinjaAPI() instance, with the core app's router mounted
under it - matches config/urls.py's job for the old DRF setup
(expenses.api.urls), just Ninja's way: one api object whose .urls is
included directly in urlpatterns instead of a DRF DefaultRouter.
"""
from ninja import NinjaAPI

from apps.core.api import router as core_router

api = NinjaAPI(title="Expense Tracker API", version="1.0.0")
api.add_router("/", core_router)
