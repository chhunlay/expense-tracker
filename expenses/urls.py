from django.urls import path

from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("quick-add", views.quick_add, name="quick_add"),
    path("add", views.add_transaction, name="add_transaction"),
    path("edit/<int:pk>", views.edit_transaction, name="edit_transaction"),
    path("delete/<int:pk>", views.delete_transaction, name="delete_transaction"),
    path("transactions", views.transactions_list, name="transactions"),
    path("export/csv", views.export_csv, name="export_csv"),
    path("export/xlsx", views.export_xlsx, name="export_xlsx"),
    path("import", views.import_transactions, name="import_transactions"),
    path("categories", views.categories_view, name="categories"),
    path("reports", views.reports, name="reports"),
]
