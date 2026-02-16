from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_http_methods
from django.utils import timezone
from datetime import timedelta, datetime
from .models import Item, Expense
from .forms import ItemForm, SearchForm


def item_list(request):
    """Главное окно - список всех предметов"""
    items = Item.objects.all()

    # Фильтр по периоду даты покупки
    date_from = request.GET.get('date_from', timezone.now().date().isoformat())
    date_to = request.GET.get('date_to', timezone.now().date().isoformat())

    if date_from:
        items = items.filter(purchase_date__gte=date_from)
    if date_to:
        items = items.filter(purchase_date__lte=date_to)

    # Фильтр проданных товаров
    hide_sold = request.GET.get('hide_sold', 'false') == 'true'
    if hide_sold:
        items = items.filter(sale_price__isnull=True)
    
    # Сортировка
    sort_by = request.GET.get('sort', '-purchase_date')
    valid_sort_fields = ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date']
    
    # Проверяем, нужна ли сортировка по прибыли (это не поле БД, а свойство)
    sort_by_profit = sort_by in ['profit', '-profit']
    
    if sort_by_profit:
        # Для прибыли сортируем в Python после получения queryset
        reverse = sort_by == '-profit'
        items_list = list(items)
        items_list.sort(key=lambda x: x.profit if x.profit is not None else float('-inf'), reverse=reverse)
        items = items_list
    elif sort_by and sort_by.lstrip('-') in valid_sort_fields:
        items = items.order_by(sort_by)
    else:
        items = items.order_by('purchase_date', 'purchase_price')
    
    # Считаем суммарную прибыль
    total_profit = sum(item.profit for item in items if item.profit is not None)
    
    # Считаем непредвиденные расходы за период
    expenses = Expense.objects.filter(date__gte=date_from, date__lte=date_to)
    total_expenses = sum(exp.amount for exp in expenses)
    
    # Чистая прибыль
    net_profit = total_profit - total_expenses
    
    # Преобразуем строки в datetime для форматирования в шаблоне
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


def add_item(request):
    """Добавление нового предмета (AJAX)"""
    if request.method == 'POST':
        form = ItemForm(request.POST)
        if form.is_valid():
            item = form.save(commit=False)
            if not item.purchase_date:
                item.purchase_date = timezone.now().date()
            item.save()
            
            # Проверяем AJAX запрос
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True})
            
            return redirect('items:item_list')
    else:
        form = ItemForm(initial={'purchase_date': timezone.now().date()})
    
    # Для обычного запроса возвращаем пустую форму (не используется)
    return JsonResponse({'form': str(form)})


def search_items(request):
    """Поиск предметов по названию"""
    query = request.GET.get('query', '')
    items = Item.objects.none()
    
    if query:
        # Поиск без учёта регистра
        # Для SQLite с русскими символами используем аннотацию
        from django.db.models import Value
        from django.db.models.functions import Lower
        
        items = Item.objects.annotate(
            name_lower=Lower('name')
        ).filter(
            name_lower__icontains=query.lower()
        ).order_by('purchase_date', 'purchase_price')
    
    # Считаем суммарную прибыль (только для предметов с заполненной ценой продажи)
    total_profit = sum(item.profit for item in items if item.profit is not None)
    
    return render(request, 'items/search_results.html', {
        'items': items,
        'query': query,
        'total_profit': total_profit,
    })


@require_POST
def update_item(request, pk):
    """API для обновления предмета (AJAX)"""
    item = get_object_or_404(Item, pk=pk)
    
    field = request.POST.get('field')
    value = request.POST.get('value')
    
    if field not in ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date']:
        return JsonResponse({'error': 'Invalid field'}, status=400)
    
    # Обработка пустых значений для nullable полей
    if value == '' and field in ['sale_price', 'sale_date']:
        setattr(item, field, None)
        item.save()
        return JsonResponse({'success': True, 'value': None})
    
    try:
        if field in ['purchase_price', 'sale_price']:
            value = int(value) if value else None
        setattr(item, field, value)
        item.save()
        
        # Для profit возвращаем вычисленное значение
        response_data = {'success': True, 'value': str(value)}
        if field in ['purchase_price', 'sale_price']:
            response_data['profit'] = str(item.profit) if item.profit is not None else ''
            response_data['is_negative'] = item.profit < 0 if item.profit is not None else False
        
        return JsonResponse(response_data)
    except (ValueError, TypeError) as e:
        return JsonResponse({'error': str(e)}, status=400)


@require_http_methods(["POST", "DELETE"])
def delete_item(request, pk):
    """Удаление предмета"""
    item = get_object_or_404(Item, pk=pk)
    item.delete()
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})
    
    return redirect('items:item_list')


def expense_list(request):
    """Список непредвиденных расходов (AJAX)"""
    expenses = Expense.objects.all().order_by('-date')
    data = [{
        'id': exp.id,
        'date': exp.date.isoformat(),
        'amount': exp.amount
    } for exp in expenses]
    return JsonResponse({'expenses': data})


@require_http_methods(["POST", "PUT"])
def expense_create(request):
    """Создание непредвиденных расходов (AJAX)"""
    if request.method == 'POST':
        date = request.POST.get('date')
        amount = request.POST.get('amount')
        
        try:
            expense = Expense.objects.create(
                date=date,
                amount=int(amount)
            )
            return JsonResponse({'success': True, 'id': expense.id})
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Invalid method'}, status=400)


@require_http_methods(["POST", "PUT"])
def expense_update(request, pk):
    """Обновление непредвиденных расходов (AJAX)"""
    expense = get_object_or_404(Expense, pk=pk)
    
    if request.method in ['POST', 'PUT']:
        date = request.POST.get('date')
        amount = request.POST.get('amount')
        
        try:
            if date:
                expense.date = date
            if amount:
                expense.amount = int(amount)
            expense.save()
            return JsonResponse({'success': True})
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Invalid method'}, status=400)


@require_http_methods(["POST", "DELETE"])
def expense_delete(request, pk):
    """Удаление непредвиденных расходов (AJAX)"""
    expense = get_object_or_404(Expense, pk=pk)
    expense.delete()
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})
    
    return redirect('items:item_list')
