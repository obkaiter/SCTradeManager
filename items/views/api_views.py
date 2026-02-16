"""
API views для предметов (AJAX запросы).
"""
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_http_methods
from django.utils import timezone
from django.shortcuts import get_object_or_404
from items.models import Item
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
        item.save()

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': True})

    return JsonResponse({'error': 'Invalid form data'}, status=400)


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
    
    if field in ['purchase_price', 'sale_price']:
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

    from django.shortcuts import redirect
    return redirect('items:item_list')
