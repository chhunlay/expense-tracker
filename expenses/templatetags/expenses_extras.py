"""
Same two custom filters as the Flask version's Jinja filters in app.py
(money_filter, monthlabel_filter) - Django's template filter registration
is the direct equivalent of Flask's @app.template_filter.
"""
from datetime import datetime

from django import template

register = template.Library()


@register.filter
def money(value):
    return f"${float(value):,.2f}"


@register.filter
def monthlabel(month_str):
    return datetime.strptime(month_str, "%Y-%m").strftime("%B %Y")
