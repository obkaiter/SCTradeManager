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
    """Страница аналитики с диаграммой чистой прибыли по дням."""
    from collections import defaultdict
    # Получаем параметры фильтрации
    date_from = request.GET.get('date_from', (timezone.now().date() - timedelta(days=30)).isoformat())
    date_to = request.GET.get('date_to', timezone.now().date().isoformat())

    # Получаем прибыль по дням продажи
    daily_profit_data = Item.objects.filter(
        sale_date__isnull=False,
        sale_date__gte=date_from,
        sale_date__lte=date_to
    ).annotate(
        profit=F('sale_price') - F('purchase_price')
    ).values('sale_date').annotate(
        total_profit=Sum('profit')
    ).order_by('sale_date')

    # Считаем общую валовую прибыль за период
    gross_profit = sum(entry['total_profit'] or 0 for entry in daily_profit_data)

    # Получаем расходы по дням
    expenses_in_period = ExpenseService.get_expenses_in_period(date_from, date_to)
    daily_expenses_data = defaultdict(int)
    for exp in expenses_in_period:
        daily_expenses_data[exp.date] += exp.amount

    # Считаем общую сумму расходов за период
    total_expenses = ExpenseService.calculate_total_expenses(expenses_in_period)

    # Считаем чистую прибыль (валовая прибыль - расходы)
    total_profit = gross_profit - total_expenses

    # Считаем оборот денег за период (сумма всех продаж + сумма всех покупок в периоде)
    # Продажи за период
    sales_total = Item.objects.filter(
        sale_date__isnull=False,
        sale_date__gte=date_from,
        sale_date__lte=date_to
    ).aggregate(total=Sum('sale_price'))['total'] or 0

    # Покупки за период
    purchases_total = Item.objects.filter(
        purchase_date__gte=date_from,
        purchase_date__lte=date_to
    ).aggregate(total=Sum('purchase_price'))['total'] or 0

    # Общий оборот денег
    turnover = sales_total + purchases_total

    # Собираем все даты (продажи и расходы) в диапазоне
    all_dates = set()
    for entry in daily_profit_data:
        all_dates.add(entry['sale_date'])
    for exp_date in daily_expenses_data.keys():
        all_dates.add(exp_date)

    # Сортируем даты
    labels = []
    data = []  # Чистая прибыль по дням

    for date in sorted(all_dates):
        labels.append(date.strftime('%Y-%m-%d'))
        # Прибыль от продаж в этот день
        day_profit = 0
        for entry in daily_profit_data:
            if entry['sale_date'] == date:
                day_profit = entry['total_profit'] or 0
                break
        # Расходы в этот день
        day_expenses = daily_expenses_data.get(date, 0)
        # Чистая прибыль = прибыль от продаж - расходы за день
        day_net_profit = day_profit - day_expenses
        data.append(day_net_profit)

    # Считаем зарезервированную сумму (предметы без даты продажи, купленные в периоде)
    reserved_items = Item.objects.filter(
        sale_date__isnull=True,
        purchase_date__gte=date_from,
        purchase_date__lte=date_to
    )
    reserved_amount = ItemService.calculate_reserved_amount(reserved_items)

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
        'total_expenses': total_expenses,
        'reserved_amount': reserved_amount,
        'turnover': turnover,
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

    # Фильтруем предметы по дате покупки (для отображения в таблице)
    items = ItemService.get_items_filtered(date_from, date_to, hide_sold, name_filter)

    # Сортируем
    items = ItemService.sort_items(items, sort_by)

    # Считаем валовую прибыль по предметам с sale_date в периоде (как в analytics)
    sold_items_in_period = Item.objects.filter(
        sale_date__isnull=False,
        sale_date__gte=date_from,
        sale_date__lte=date_to
    )
    total_profit = sold_items_in_period.aggregate(
        total=Sum(F('sale_price') - F('purchase_price'))
    )['total'] or 0

    # Считаем расходы за период
    expenses = ExpenseService.get_expenses_in_period(date_from, date_to)
    total_expenses = ExpenseService.calculate_total_expenses(expenses)

    # Считаем зарезервированную сумму (предметы без даты продажи, купленные в периоде)
    reserved_items = Item.objects.filter(
        sale_date__isnull=True,
        purchase_date__gte=date_from,
        purchase_date__lte=date_to
    )
    reserved_amount = ItemService.calculate_reserved_amount(reserved_items)

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
