"""
Nav items + version, available on every template - the Django
equivalent of the Flask version's {% set nav_items = [...] %} in
base.html (Django templates can't build a list-of-tuples literal inline
the way Jinja can) and its inject_version() context processor.
"""
from django.urls import reverse
from django.utils.translation import gettext as _

__version__ = "1.2.0"

# (section label or None, [(url_name, icon, label, [url_names that
# should also highlight this item], ...]) - Add/Edit live under the
# Transactions page (its own "+ Add" button), not as separate nav
# entries, so their views still highlight "Transactions" instead of
# leaving the sidebar blank. Section labels group related items visually
# (e.g. "Accounting") without being clickable themselves.
def _nav_sections():
    return [
        (None, [
            ("dashboard", "📊", _("Dashboard"), []),
            ("transactions", "📋", _("Transactions"), ["add_transaction", "edit_transaction"]),
            ("categories", "🏷️", _("Categories"), []),
            ("reports", "📈", _("Reports"), []),
        ]),
        (_("Accounting"), [
            ("assets", "💼", _("Assets"), []),
        ]),
        (None, [
            ("settings", "⚙️", _("Settings"), []),
        ]),
    ]


def nav(request):
    current = getattr(request.resolver_match, "url_name", None)
    sections = []
    for label, entries in _nav_sections():
        items = []
        for url_name, icon, item_label, also_active_for in entries:
            active = current == url_name or current in also_active_for
            items.append({"url": reverse(url_name), "icon": icon, "label": item_label, "active": active})
        sections.append({"label": label, "items": items})
    return {"nav_sections": sections, "app_version": __version__}
