"""
Views для работы с предметами.
"""
from datetime import datetime, timedelta

from django.shortcuts import render
from django.utils import timezone

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


def analytics(request):
    """Страница аналитики с диаграммой прибыли по дням."""
    date_from, date_to, date_from_obj, date_to_obj = _parse_date_range(request)

    # Прибыль по дням продажи (оптимизировано)
    daily_profit_data = ItemService.get_daily_profit_data(date_from, date_to)

    # Расходы по дням (оптимизировано)
    daily_expenses_data = ExpenseService.get_daily_expenses_data(date_from, date_to)

    # Собираем все даты
    all_dates = set()
    for entry in daily_profit_data:
        all_dates.add(entry['date'])
    for exp_date in daily_expenses_data.keys():
        all_dates.add(exp_date)

    # Формируем данные для диаграммы
    labels = []
    data = []
    for date in sorted(all_dates):
        labels.append(date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else str(date))
        day_profit = next(
            (entry['total_profit'] or 0 for entry in daily_profit_data if entry['date'] == date),
            0
        )
        day_expenses = daily_expenses_data.get(date, 0)
        data.append(day_profit - day_expenses)

    # Финансовые показатели (оптимизировано с кэшированием)
    financials = ItemService.calculate_financials_fast(date_from, date_to)

    # Данные для круговой диаграммы (оптимизировано)
    items_list = ItemService.get_items_profit_by_name(date_from, date_to)

    # Параметры фильтра
    hide_sold = request.GET.get('hide_sold', 'false')
    name_filter = request.GET.get('name', '')
    sort_by = request.GET.get('sort', '-purchase_date')

    return render(request, 'items/analytics.html', {
        'labels': labels,
        'data': data,
        'items': items_list,
        'date_from': date_from_obj,
        'date_to': date_to_obj,
        'gross_profit': financials['gross_profit'],
        'total_profit': financials['net_profit'],
        'total_expenses': financials['total_expenses'],
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

    # Финансовые показатели (оптимизировано с кэшированием)
    financials = ItemService.calculate_financials_fast(date_from, date_to)

    return render(request, 'items/item_list.html', {
        'items': items,
        'date_from': date_from_obj,
        'date_to': date_to_obj,
        'gross_profit': financials['gross_profit'],
        'total_profit': financials['net_profit'],
        'total_expenses': financials['total_expenses'],
        'reserved_amount': financials['reserved_amount'],
        'net_profit': financials['net_profit'],
        'turnover': financials['turnover'],
        'sort_by': sort_by,
        'hide_sold': hide_sold,
    })
