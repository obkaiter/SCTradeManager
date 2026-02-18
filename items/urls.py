from django.urls import path
from items.views import (
    item_list,
    add_item,
    update_item,
    delete_item,
    expense_list,
    expense_create,
    expense_update,
    expense_delete,
)

app_name = 'items'

urlpatterns = [
    path('', item_list, name='item_list'),
    path('add/', add_item, name='add_item'),
    path('<int:pk>/update/', update_item, name='update_item'),
    path('<int:pk>/delete/', delete_item, name='delete_item'),
    path('expenses/', expense_list, name='expense_list'),
    path('expenses/create/', expense_create, name='expense_create'),
    path('expenses/<int:pk>/update/', expense_update, name='expense_update'),
    path('expenses/<int:pk>/delete/', expense_delete, name='expense_delete'),
]
