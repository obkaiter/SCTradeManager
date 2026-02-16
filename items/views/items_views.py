"""
Views для работы с предметами.
"""
from django.shortcuts import render
from django.utils import timezone
from datetime import datetime
from items.services import ItemService, ExpenseService


def item_list(request):
    """Главное окно - список всех предметов."""
    # Получаем параметры фильтрации
    date_from = request.GET.get('date_from', timezone.now().date().isoformat())
    date_to = request.GET.get('date_to', timezone.now().date().isoformat())
    hide_sold = request.GET.get('hide_sold', 'false') == 'true'
    sort_by = request.GET.get('sort', '-purchase_date')

    # Фильтруем предметы
    items = ItemService.get_items_filtered(date_from, date_to, hide_sold)
    
    # Сортируем
    items = ItemService.sort_items(items, sort_by)
    
    # Считаем прибыль
    total_profit = ItemService.calculate_total_profit(items)
    
    # Считаем расходы за период
    expenses = ExpenseService.get_expenses_in_period(date_from, date_to)
    total_expenses = ExpenseService.calculate_total_expenses(expenses)
    
    # Чистая прибыль
    net_profit = total_profit - total_expenses

    # Преобразуем строки в datetime для шаблона
    try:
        date_from_obj = datetime.strptime(date_from, '%Y-%m-%d')
        date_to_obj = datetime.strptime(date_to, '%Y-%m-%d')
    except (ValueError, TypeError):
        date_from_obj = timezone.now()
        date_to_obj = timezone.now()

    return render(request, 'items/item_list.html', {
        'items': items,
        'date_from': date_from_obj,
        'date_to': date_to_obj,
        'total_profit': total_profit,
        'total_expenses': total_expenses,
        'net_profit': net_profit,
        'sort_by': sort_by,
        'hide_sold': hide_sold,
    })


def search_items(request):
    """Поиск предметов по названию."""
    query = request.GET.get('query', '')
    items = ItemService.search_by_query(query)
    total_profit = ItemService.calculate_total_profit(items)

    return render(request, 'items/search_results.html', {
        'items': items,
        'query': query,
        'total_profit': total_profit,
    })
