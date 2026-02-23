"""
Views для работы с расходами (AJAX API).
"""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404, redirect
from items.models import Expense
from items.services import ExpenseService


@require_http_methods(["GET"])
def expense_list(request):
    """Список расходов (AJAX)."""
    data = ExpenseService.get_all_expenses_data()
    return JsonResponse({'expenses': data})


@require_http_methods(["POST"])
def expense_create(request):
    """Создание расхода (AJAX)."""
    date = request.POST.get('date')
    amount = request.POST.get('amount')

    expense, error = ExpenseService.create_expense(date, amount)

    if error:
        return JsonResponse({'error': error}, status=400)

    return JsonResponse({'success': True, 'id': expense.id})


@require_http_methods(["POST"])
def expense_update(request, pk):
    """Обновление расхода (AJAX)."""
    expense = get_object_or_404(Expense, pk=pk)
    date = request.POST.get('date')
    amount = request.POST.get('amount')

    success, error = ExpenseService.update_expense(expense, date, amount)

    if error:
        return JsonResponse({'error': error}, status=400)

    return JsonResponse({'success': True})


@require_http_methods(["POST", "DELETE"])
def expense_delete(request, pk):
    """Удаление расхода (AJAX)."""
    expense = get_object_or_404(Expense, pk=pk)
    expense.delete()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})

    return redirect('items:item_list')
