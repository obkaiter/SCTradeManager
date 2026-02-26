"""
Сервисный слой для бизнес-логики предметов и расходов.
"""
from django.db.models import Q, Sum
from items.models import Item, Expense


class ItemService:
    """Сервис для работы с предметами."""

    @staticmethod
    def get_items_filtered(date_from=None, date_to=None, hide_sold=False, name_filter=''):
        """
        Получить отфильтрованный список предметов.
        Фильтрация: предмет попадает в выборку, если дата покупки ИЛИ дата продажи
        находится в указанном диапазоне.
        """
        items = Item.objects.all()

        if date_from and date_to:
            items = items.filter(
                Q(purchase_date__gte=date_from) | Q(sale_date__gte=date_from)
            ).filter(
                Q(purchase_date__lte=date_to) | Q(sale_date__lte=date_to)
            )
        elif date_from:
            items = items.filter(
                Q(purchase_date__gte=date_from) | Q(sale_date__gte=date_from)
            )
        elif date_to:
            items = items.filter(
                Q(purchase_date__lte=date_to) | Q(sale_date__lte=date_to)
            )

        if hide_sold:
            items = items.filter(sale_price__isnull=True)
        if name_filter:
            items = items.filter(name__icontains=name_filter)

        return items

    @staticmethod
    def sort_items(items, sort_by):
        """
        Сортировка предметов.
        """
        valid_sort_fields = ['name', 'quantity', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date']

        if sort_by in ['profit', '-profit']:
            items_list = list(items)
            items_list.sort(
                key=lambda x: x.profit if x.profit is not None else float('-inf'),
                reverse=(sort_by == '-profit')
            )
            return items_list

        if sort_by and sort_by.lstrip('-') in valid_sort_fields:
            return items.order_by(sort_by)

        return items.order_by('-purchase_date')

    @staticmethod
    def calculate_total_profit(items):
        """Рассчитать суммарную прибыль."""
        return sum(item.profit for item in items if item.profit is not None)

    @staticmethod
    def calculate_reserved_amount(items):
        """
        Рассчитать сумму зарезервированных предметов.
        items должен быть отфильтрован по sale_date__isnull=True
        """
        result = items.aggregate(total=Sum('purchase_price'))['total']
        return result or 0

    @staticmethod
    def update_item(item, field, value):
        """
        Обновить поле предмета.
        Returns: tuple (success: bool, error: str|None)
        """
        valid_fields = ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date', 'quantity']

        if field not in valid_fields:
            return False, 'Invalid field'

        try:
            if value == '' and field in ['sale_price', 'sale_date']:
                setattr(item, field, None)
            elif field in ['purchase_price', 'sale_price', 'quantity']:
                setattr(item, field, int(value) if value else None)
            else:
                setattr(item, field, value)

            item.save()
            return True, None

        except (ValueError, TypeError) as e:
            return False, str(e)


class ExpenseService:
    """Сервис для работы с расходами."""

    @staticmethod
    def get_expenses_in_period(date_from=None, date_to=None):
        """Получить расходы за период."""
        expenses = Expense.objects.all()
        if date_from:
            expenses = expenses.filter(date__gte=date_from)
        if date_to:
            expenses = expenses.filter(date__lte=date_to)
        return expenses

    @staticmethod
    def calculate_total_expenses(expenses):
        """Рассчитать сумму расходов."""
        return sum(exp.amount for exp in expenses)

    @staticmethod
    def get_all_expenses_data():
        """Получить все расходы в формате для API."""
        expenses = Expense.objects.all().order_by('-date')
        return [{
            'id': exp.id,
            'date': exp.date.isoformat(),
            'amount': exp.amount
        } for exp in expenses]

    @staticmethod
    def create_expense(date, amount):
        """
        Создать запись о расходе.
        Returns: tuple (expense: Expense|None, error: str|None)
        """
        try:
            expense = Expense.objects.create(date=date, amount=int(amount))
            return expense, None
        except (ValueError, TypeError) as e:
            return None, str(e)

    @staticmethod
    def update_expense(expense, date=None, amount=None):
        """
        Обновить запись о расходе.
        Returns: tuple (success: bool, error: str|None)
        """
        try:
            if date:
                expense.date = date
            if amount:
                expense.amount = int(amount)
            expense.save()
            return True, None
        except (ValueError, TypeError) as e:
            return False, str(e)
