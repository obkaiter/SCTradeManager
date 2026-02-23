"""
Views для работы с предметами.
"""
from django.shortcuts import render
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Sum, F
from items.models import Item
from items.services import ItemService, ExpenseService


def analytics(request):
    """Страница аналитики с диаграммой прибыли по дням."""
    # Получаем параметры фильтрации
    date_from = request.GET.get('date_from', (timezone.now().date() - timedelta(days=30)).isoformat())
    date_to = request.GET.get('date_to', timezone.now().date().isoformat())

    # Получаем прибыль по дням продажи
    daily_profit = Item.objects.filter(
        sale_date__isnull=False,
        sale_date__gte=date_from,
        sale_date__lte=date_to
    ).annotate(
        profit=F('sale_price') - F('purchase_price')
    ).values('sale_date').annotate(
        total_profit=Sum('profit')
    ).order_by('sale_date')

    # Преобразуем в формат для Chart.js
    labels = []
    data = []
    for entry in daily_profit:
        labels.append(entry['sale_date'].strftime('%Y-%m-%d'))
        data.append(entry['total_profit'] or 0)

    # Считаем общую прибыль за период (без учёта расходов)
    gross_profit = sum(data)

    # Считаем расходы за период
    expenses = ExpenseService.get_expenses_in_period(date_from, date_to)
    total_expenses = ExpenseService.calculate_total_expenses(expenses)

    # Считаем чистую прибыль (с учётом расходов)
    total_profit = gross_profit - total_expenses

    # Считаем зарезервированную сумму (предметы без даты продажи, купленные в периоде)
    items_in_period = Item.objects.filter(
        purchase_date__gte=date_from,
        purchase_date__lte=date_to
    )
    reserved_amount = ItemService.calculate_reserved_amount(items_in_period)

    # Преобразуем строки в datetime для шаблона
    try:
        date_from_obj = datetime.strptime(date_from, '%Y-%m-%d')
        date_to_obj = datetime.strptime(date_to, '%Y-%m-%d')
    except (ValueError, TypeError):
        date_from_obj = timezone.now() - timedelta(days=30)
        date_to_obj = timezone.now()

    # Получаем дополнительные параметры фильтра для кнопки "На главную"
    hide_sold = request.GET.get('hide_sold', 'false')
    name_filter = request.GET.get('name', '')
    sort_by = request.GET.get('sort', '-purchase_date')

    return render(request, 'items/analytics.html', {
        'labels': labels,
        'data': data,
        'date_from': date_from_obj,
        'date_to': date_to_obj,
        'total_profit': total_profit,
        'gross_profit': gross_profit,
        'total_expenses': total_expenses,
        'reserved_amount': reserved_amount,
        'hide_sold': hide_sold,
        'name_filter': name_filter,
        'sort_by': sort_by,
    })


def item_list(request):
    """Главное окно - список всех предметов."""
    # Получаем параметры фильтрации
    date_from = request.GET.get('date_from', timezone.now().date().isoformat())
    date_to = request.GET.get('date_to', timezone.now().date().isoformat())
    hide_sold = request.GET.get('hide_sold', 'false') == 'true'
    sort_by = request.GET.get('sort', '-purchase_date')
    name_filter = request.GET.get('name', '')

    # Фильтруем предметы
    items = ItemService.get_items_filtered(date_from, date_to, hide_sold, name_filter)
    
    # Сортируем
    items = ItemService.sort_items(items, sort_by)
    
    # Считаем прибыль
    total_profit = ItemService.calculate_total_profit(items)

    # Считаем расходы за период
    expenses = ExpenseService.get_expenses_in_period(date_from, date_to)
    total_expenses = ExpenseService.calculate_total_expenses(expenses)

    # Считаем зарезервированную сумму (предметы без даты продажи)
    reserved_amount = ItemService.calculate_reserved_amount(items)

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
        'reserved_amount': reserved_amount,
        'net_profit': net_profit,
        'sort_by': sort_by,
        'hide_sold': hide_sold,
    })
