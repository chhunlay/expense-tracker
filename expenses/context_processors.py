"""
Nav items + version, available on every template - the Django
equivalent of the Flask version's {% set nav_items = [...] %} in
base.html (Django templates can't build a list-of-tuples literal inline
the way Jinja can) and its inject_version() context processor.
"""
from django.urls import reverse

__version__ = "1.0.0"

# (url_name, icon, label, [url_names that should also highlight this nav
# item when active]) - Add/Edit live under the Transactions page (its
# own "+ Add" button), not as separate nav entries, so their views still
# highlight "Transactions" instead of leaving the sidebar blank.
NAV_ITEMS = [
    ("dashboard", "📊", "Dashboard", []),
    ("transactions", "📋", "Transactions", ["add_transaction", "edit_transaction"]),
    ("categories", "🏷️", "Categories", []),
    ("reports", "📈", "Reports", []),
]


def nav(request):
    current = getattr(request.resolver_match, "url_name", None)
    items = []
    for url_name, icon, label, also_active_for in NAV_ITEMS:
        active = current == url_name or current in also_active_for
        items.append({"url": reverse(url_name), "icon": icon, "label": label, "active": active})
    return {"nav_items": items, "app_version": __version__}
