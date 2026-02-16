from django.contrib import admin
from .models import Item, Expense


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date', 'profit']
    list_filter = ['purchase_date', 'sale_date']
    search_fields = ['name']


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['date', 'amount']
    list_filter = ['date']
