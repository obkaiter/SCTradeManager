"""
API views для предметов (AJAX запросы).
"""
from datetime import datetime, timedelta
import urllib.request
import ssl
import json

from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_http_methods
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.cache import cache_control

from items.models import Item, FleshPrice, PriceItem
from items.forms import ItemForm
from items.services import ItemService, ExpenseService, PriceCheckService


@require_POST
def add_item(request):
    """Добавление нового предмета (AJAX)."""
    form = ItemForm(request.POST)

    if form.is_valid():
        item = form.save(commit=False)
        if not item.purchase_date:
            item.purchase_date = timezone.now().date()
        if not item.quantity:
            item.quantity = 1
        item.save()

        return JsonResponse({
            'success': True,
            'item': {
                'id': item.id,
                'name': item.name,
                'purchase_price': item.purchase_price,
                'sale_price': item.sale_price,
                'purchase_date': item.purchase_date.isoformat() if item.purchase_date else None,
                'sale_date': item.sale_date.isoformat() if item.sale_date else None,
                'quantity': item.quantity,
            }
        })

    return JsonResponse(
        {'error': 'Invalid form data', 'errors': form.errors.get_json_data()},
        status=400
    )


@require_POST
def update_item(request, pk):
    """API для обновления предмета (AJAX)."""
    item = get_object_or_404(Item, pk=pk)
    field = request.POST.get('field')
    value = request.POST.get('value')

    success, error = ItemService.update_item(item, field, value)

    if not success:
        return JsonResponse({'error': error}, status=400)

    response_data = {'success': True, 'value': str(value)}

    if field in ['purchase_price', 'sale_price', 'quantity']:
        response_data['profit'] = str(item.profit) if item.profit is not None else ''
        response_data['is_negative'] = item.profit < 0 if item.profit is not None else False

    # Добавляем обновлённые финансовые показатели (оптимизировано)
    # Получаем параметры фильтрации из запроса
    date_from = request.headers.get('X-Date-From', request.GET.get('date_from', ''))
    date_to = request.headers.get('X-Date-To', request.GET.get('date_to', ''))

    # Значения по умолчанию — последние 30 дней
    if not date_from:
        date_from_obj = timezone.now().date() - timedelta(days=30)
    else:
        try:
            date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            date_from_obj = timezone.now().date() - timedelta(days=30)

    if not date_to:
        date_to_obj = timezone.now().date()
    else:
        try:
            date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            date_to_obj = timezone.now().date()

    # Оптимизированный расчёт финансовых показателей
    financials = ItemService.calculate_financials_fast(date_from_obj, date_to_obj)

    response_data['financials'] = {
        'total_profit': financials['net_profit'],
        'total_expenses': financials['total_expenses'],
        'reserved_amount': financials['reserved_amount'],
        'net_profit': financials['net_profit'],
    }

    return JsonResponse(response_data)


@require_http_methods(["POST", "DELETE"])
def delete_item(request, pk):
    """Удаление предмета."""
    item = get_object_or_404(Item, pk=pk)
    item.delete()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})

    return redirect('items:item_list')


@require_http_methods(["GET", "POST"])
def flesh_prices(request):
    """Получение или сохранение цен закупки мякоти."""
    if request.method == "GET":
        prices = FleshPrice.get_prices()
        return JsonResponse({
            'success': True,
            'prices': {
                'solovik': prices.solovik,
                'slastena': prices.slastena,
                'kubarbuz': prices.kubarbuz,
                'limonnik': prices.limonnik,
                'comment': prices.comment,
            }
        })

    elif request.method == "POST":
        try:
            prices = FleshPrice.get_prices()
            prices.solovik = int(request.POST.get('solovik', 0))
            prices.slastena = int(request.POST.get('slastena', 0))
            prices.kubarbuz = int(request.POST.get('kubarbuz', 0))
            prices.limonnik = int(request.POST.get('limonnik', 0))
            prices.comment = request.POST.get('comment', '')
            prices.save()

            return JsonResponse({
                'success': True,
                'prices': {
                    'solovik': prices.solovik,
                    'slastena': prices.slastena,
                    'kubarbuz': prices.kubarbuz,
                    'limonnik': prices.limonnik,
                    'comment': prices.comment,
                }
            })
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': str(e)}, status=400)


@require_POST
def add_flesh_items(request):
    """Добавление предметов мякоти."""
    try:
        today = timezone.now().date()

        # Данные из запроса
        flesh_data = {
            'Мякоть солевика': {
                'qty': int(request.POST.get('solovik_qty', 0)),
                'price_key': 'solovik'
            },
            'Мякоть сластены': {
                'qty': int(request.POST.get('slastena_qty', 0)),
                'price_key': 'slastena'
            },
            'Мякоть куборбуза': {
                'qty': int(request.POST.get('kubarbuz_qty', 0)),
                'price_key': 'kubarbuz'
            },
            'Мякоть лимонника': {
                'qty': int(request.POST.get('limonnik_qty', 0)),
                'price_key': 'limonnik'
            },
        }

        # Получаем цены
        prices = FleshPrice.get_prices()
        price_map = {
            'solovik': prices.solovik,
            'slastena': prices.slastena,
            'kubarbuz': prices.kubarbuz,
            'limonnik': prices.limonnik,
        }

        results = []

        for name, data in flesh_data.items():
            qty = data['qty']
            if qty <= 0:
                continue

            price_per_unit = price_map[data['price_key']]
            total_purchase_price = qty * price_per_unit

            # Ищем предмет с таким названием за сегодня без продажи
            # Сначала ищем запись без sale_price и sale_date (которую можно обновлять)
            existing_item = Item.objects.filter(
                name=name,
                purchase_date=today,
                sale_price__isnull=True,
                sale_date__isnull=True
            ).first()
            
            # Если не нашли, ищем любую запись за сегодня (для создания новой)
            if not existing_item:
                existing_item = Item.objects.filter(
                    name=name,
                    purchase_date=today
                ).first()

            # Проверяем, нужно ли создавать новую запись
            create_new = False
            if existing_item:
                # Если есть цена продажи или дата продажи — создаём новую запись
                has_sale_price = existing_item.sale_price is not None and existing_item.sale_price != 0
                has_sale_date = existing_item.sale_date is not None
                if has_sale_price or has_sale_date:
                    create_new = True

            if existing_item and not create_new:
                # Обновляем существующий
                existing_item.quantity += qty
                existing_item.purchase_price += total_purchase_price
                existing_item.save()
                results.append({
                    'name': name,
                    'action': 'updated',
                    'quantity': existing_item.quantity,
                    'purchase_price': existing_item.purchase_price
                })
            else:
                # Создаём новый
                new_item = Item.objects.create(
                    name=name,
                    purchase_price=total_purchase_price,
                    purchase_date=today,
                    quantity=qty
                )
                results.append({
                    'name': name,
                    'action': 'created',
                    'quantity': new_item.quantity,
                    'purchase_price': new_item.purchase_price
                })

        return JsonResponse({
            'success': True,
            'results': results
        })

    except (ValueError, TypeError) as e:
        return JsonResponse({'error': str(e)}, status=400)


@cache_control(no_cache=True)
def price_analytics(request):
    """Страница аналитики цен."""
    from django.utils import timezone
    from datetime import timedelta
    import math
    
    # Получаем параметры фильтра из запроса
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    hide_sold = request.GET.get('hide_sold', 'false')
    name_filter = request.GET.get('name', '')
    sort_by = request.GET.get('sort', 'name')
    
    # Значения по умолчанию
    if not date_from:
        date_from = (timezone.now().date() - timedelta(days=30)).isoformat()
    if not date_to:
        date_to = timezone.now().date().isoformat()
    
    # Сортировка
    valid_sort_fields = ['name', '-name', 'price_24h', '-price_24h', 'amount_24h', '-amount_24h', 'price_with_commission', '-price_with_commission']
    if sort_by not in valid_sort_fields:
        sort_by = 'name'
    
    # Для price_24h и amount_24h используем NULLS LAST чтобы предметы без данных были в конце
    if sort_by == 'price_24h':
        items = PriceItem.objects.all().order_by('price_24h')
    elif sort_by == '-price_24h':
        items = PriceItem.objects.all().order_by('-price_24h')
    elif sort_by == 'amount_24h':
        items = PriceItem.objects.all().order_by('amount_24h')
    elif sort_by == '-amount_24h':
        items = PriceItem.objects.all().order_by('-amount_24h')
    elif sort_by == 'price_with_commission':
        items = PriceItem.objects.all().order_by('price_24h')
    elif sort_by == '-price_with_commission':
        items = PriceItem.objects.all().order_by('-price_24h')
    else:
        items = PriceItem.objects.all().order_by(sort_by)
    
    # Добавляем цену с комиссией для каждого предмета
    items_with_commission = []
    for item in items:
        item_data = {
            'id': item.id,
            'name': item.name,
            'price_24h': item.price_24h,
            'amount_24h': item.amount_24h,
            'price_with_commission': None,
        }
        if item.price_24h:
            # Цена с комиссией = цена * 0.95, округление в большую сторону
            item_data['price_with_commission'] = math.ceil(item.price_24h * 0.95)
        items_with_commission.append(item_data)
    
    return render(request, 'items/price_analytics.html', {
        'items': items_with_commission,
        'date_from': date_from,
        'date_to': date_to,
        'hide_sold': hide_sold,
        'name_filter': name_filter,
        'sort_by': sort_by,
    })


@require_http_methods(["GET", "POST"])
def price_item_create(request):
    """Создание предмета для анализа цен."""
    if request.method == "POST":
        name = request.POST.get('name', '').strip()
        if not name:
            return JsonResponse({'error': 'Название предмета обязательно'}, status=400)
        
        try:
            item, created = PriceItem.objects.get_or_create(name=name)
            return JsonResponse({
                'success': True,
                'item': {
                    'id': item.id,
                    'name': item.name,
                    'price_24h': item.price_24h,
                },
                'created': created
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_http_methods(["POST", "DELETE"])
def price_item_delete(request, pk):
    """Удаление предмета из анализа цен."""
    item = get_object_or_404(PriceItem, pk=pk)
    item.delete()
    return JsonResponse({'success': True})


@require_POST
def price_item_refresh(request):
    """Обновление цен для всех предметов через парсинг."""
    try:
        items = list(PriceItem.objects.all())
        if not items:
            return JsonResponse({
                'success': True,
                'updated': 0,
                'failed': [],
                'message': 'Нет предметов для обновления'
            })

        updated_count = 0
        failed_items = []

        for item in items:
            try:
                price, amount = PriceCheckService.get_price_24h(item.name)
                if price is not None:
                    item.price_24h = price
                    item.amount_24h = amount if amount else 0
                    item.save()
                    updated_count += 1
                else:
                    failed_items.append(item.name)
            except Exception as e:
                failed_items.append(item.name)

        return JsonResponse({
            'success': True,
            'updated': updated_count,
            'failed': failed_items,
            'total': len(items)
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
