"""
API views для предметов (AJAX запросы).
"""
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_http_methods
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from django.db.models import Q
from items.models import Item, FleshPrice
from items.forms import ItemForm
from items.services import ItemService


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
            }
        })

    elif request.method == "POST":
        try:
            prices = FleshPrice.get_prices()
            prices.solovik = int(request.POST.get('solovik', 0))
            prices.slastena = int(request.POST.get('slastena', 0))
            prices.kubarbuz = int(request.POST.get('kubarbuz', 0))
            prices.limonnik = int(request.POST.get('limonnik', 0))
            prices.save()

            return JsonResponse({
                'success': True,
                'prices': {
                    'solovik': prices.solovik,
                    'slastena': prices.slastena,
                    'kubarbuz': prices.kubarbuz,
                    'limonnik': prices.limonnik,
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

            # Ищем предмет с таким названием за сегодня
            existing_item = Item.objects.filter(
                name=name,
                purchase_date=today
            ).first()

            if existing_item:
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
