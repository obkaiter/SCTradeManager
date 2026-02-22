"""
Модуль views для приложения items.
"""
from .items_views import item_list, analytics
from .api_views import add_item, update_item, delete_item
from .expenses_views import (
    expense_list,
    expense_create,
    expense_update,
    expense_delete,
)

__all__ = [
    'item_list',
    'analytics',
    'add_item',
    'update_item',
    'delete_item',
    'expense_list',
    'expense_create',
    'expense_update',
    'expense_delete',
]
