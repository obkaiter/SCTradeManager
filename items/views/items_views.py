"""
Views для работы с предметами.
"""
from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Sum, F
from django.shortcuts import render
from django.utils import timezone

from items.models import Item
from items.services import ItemService, ExpenseService


def _parse_date_range(request):
    """Парсинг диапазона дат из запроса."""
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')

    # Если даты пустые — используем значения по умолчанию
    if not date_from:
        date_from = (timezone.now().date() - timedelta(days=30)).isoformat()
    if not date_to:
        date_to = timezone.now().date().isoformat()

    try:
        date_from_obj = datetime.strptime(date_from, '%Y-%m-%d')
        date_to_obj = datetime.strptime(date_to, '%Y-%m-%d')
    except (ValueError, TypeError):
        date_from_obj = timezone.now() - timedelta(days=30)
        date_to_obj = timezone.now()

    return date_from, date_to, date_from_obj, date_to_obj


def _calculate_financials(date_from, date_to):
    """Расчёт финансовых показателей."""
    # Прибыль от продаж
    sold_items = Item.objects.filter(
        sale_date__isnull=False,
        sale_date__gte=date_from,
        sale_date__lte=date_to
    )
    total_profit = sold_items.aggregate(
        total=Sum(F('sale_price') - F('purchase_price'))
    )['total'] or 0

    # Расходы
    expenses = ExpenseService.get_expenses_in_period(date_from, date_to)
    total_expenses = ExpenseService.calculate_total_expenses(expenses)

    # Зарезервировано
    reserved_items = Item.objects.filter(
        sale_date__isnull=True,
        purchase_date__gte=date_from,
        purchase_date__lte=date_to
    )
    reserved_amount = ItemService.calculate_reserved_amount(reserved_items)

    # Оборот (сумма продаж за период)
    sales_total = sold_items.aggregate(total=Sum('sale_price'))['total'] or 0
    turnover = sales_total

    return {
        'total_profit': total_profit,
        'total_expenses': total_expenses,
        'reserved_amount': reserved_amount,
        'turnover': turnover,
        'net_profit': total_profit - total_expenses,
    }


def analytics(request):
    """Страница аналитики с диаграммой чистой прибыли по дням."""
    date_from, date_to, date_from_obj, date_to_obj = _parse_date_range(request)

    # Прибыль по дням продажи
    daily_profit_data = Item.objects.filter(
        sale_date__isnull=False,
        sale_date__gte=date_from,
        sale_date__lte=date_to
    ).annotate(
        profit=F('sale_price') - F('purchase_price')
    ).values('sale_date').annotate(
        total_profit=Sum('profit')
    ).order_by('sale_date')

    gross_profit = sum(entry['total_profit'] or 0 for entry in daily_profit_data)

    # Расходы по дням
    expenses_in_period = ExpenseService.get_expenses_in_period(date_from, date_to)
    daily_expenses_data = defaultdict(int)
    for exp in expenses_in_period:
        daily_expenses_data[exp.date] += exp.amount

    total_expenses = ExpenseService.calculate_total_expenses(expenses_in_period)
    total_profit = gross_profit - total_expenses

    # Собираем все даты
    all_dates = set()
    for entry in daily_profit_data:
        all_dates.add(entry['sale_date'])
    for exp_date in daily_expenses_data.keys():
        all_dates.add(exp_date)

    # Формируем данные для диаграммы
    labels = []
    data = []
    for date in sorted(all_dates):
        labels.append(date.strftime('%Y-%m-%d'))
        day_profit = next(
            (entry['total_profit'] or 0 for entry in daily_profit_data if entry['sale_date'] == date),
            0
        )
        day_expenses = daily_expenses_data.get(date, 0)
        data.append(day_profit - day_expenses)

    # Финансовые показатели
    financials = _calculate_financials(date_from, date_to)

    # Параметры фильтра
    hide_sold = request.GET.get('hide_sold', 'false')
    name_filter = request.GET.get('name', '')
    sort_by = request.GET.get('sort', '-purchase_date')

    return render(request, 'items/analytics.html', {
        'labels': labels,
        'data': data,
        'date_from': date_from_obj,
        'date_to': date_to_obj,
        'total_profit': total_profit,
        'total_expenses': total_expenses,
        'reserved_amount': financials['reserved_amount'],
        'turnover': financials['turnover'],
        'hide_sold': hide_sold,
        'name_filter': name_filter,
        'sort_by': sort_by,
    })


def item_list(request):
    """Главное окно - список всех предметов."""
    date_from, date_to, date_from_obj, date_to_obj = _parse_date_range(request)
    hide_sold = request.GET.get('hide_sold', 'false') == 'true'
    sort_by = request.GET.get('sort', '-purchase_date')
    name_filter = request.GET.get('name', '')

    # Фильтрация и сортировка
    items = ItemService.get_items_filtered(date_from, date_to, hide_sold, name_filter)
    items = ItemService.sort_items(items, sort_by)

    # Финансовые показатели
    financials = _calculate_financials(date_from, date_to)

    return render(request, 'items/item_list.html', {
        'items': items,
        'date_from': date_from_obj,
        'date_to': date_to_obj,
        'total_profit': financials['total_profit'],
        'total_expenses': financials['total_expenses'],
        'reserved_amount': financials['reserved_amount'],
        'net_profit': financials['net_profit'],
        'sort_by': sort_by,
        'hide_sold': hide_sold,
    })
