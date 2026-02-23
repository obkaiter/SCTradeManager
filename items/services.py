"""
Сервисный слой для бизнес-логики предметов и расходов.
"""
from datetime import datetime
from django.utils import timezone
from django.db.models import Q
from items.models import Item, Expense


class ItemService:
    """Сервис для работы с предметами."""

    @staticmethod
    def get_items_filtered(date_from=None, date_to=None, hide_sold=False, name_filter=''):
        """
        Получить отфильтрованный список предметов.
        Фильтрация: предмет попадает в выборку, если дата покупки ИЛИ дата продажи
        находится в указанном диапазоне.

        Args:
            date_from: Дата начала периода
            date_to: Дата конца периода
            hide_sold: Скрыть проданные предметы
            name_filter: Фильтр по названию предмета (частичное совпадение, без учёта регистра)

        Returns:
            QuerySet предметов
        """
        items = Item.objects.all()

        # Фильтрация по диапазону дат (покупка ИЛИ продажа)
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
        
        Args:
            items: QuerySet или список предметов
            sort_by: Поле для сортировки
            
        Returns:
            Отсортированный список предметов
        """
        valid_sort_fields = ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date']
        
        # Сортировка по прибыли (не поле БД, а свойство)
        if sort_by in ['profit', '-profit']:
            items_list = list(items)
            reverse = sort_by == '-profit'
            items_list.sort(
                key=lambda x: x.profit if x.profit is not None else float('-inf'),
                reverse=reverse
            )
            return items_list
        
        # Сортировка по полям БД
        if sort_by and sort_by.lstrip('-') in valid_sort_fields:
            return items.order_by(sort_by)
        
        return items.order_by('-purchase_date')

    @staticmethod
    def calculate_total_profit(items):
        """
        Рассчитать суммарную прибыль.

        Args:
            items: Список предметов

        Returns:
            Общая прибыль
        """
        return sum(item.profit for item in items if item.profit is not None)

    @staticmethod
    def calculate_reserved_amount(items):
        """
        Рассчитать сумму зарезервированных предметов.
        Считается по цене закупа. Возвращает абсолютное значение (неотрицательное).

        Args:
            items: QuerySet предметов (должен быть отфильтрован по sale_date__isnull=True)

        Returns:
            Зарезервированная сумма (неотрицательное число)
        """
        from django.db.models import Sum
        result = items.aggregate(total=Sum('purchase_price'))['total']
        return abs(result) if result else 0

    @staticmethod
    def update_item(item, field, value):
        """
        Обновить поле предмета.
        
        Args:
            item: Экземпляр Item
            field: Имя поля
            value: Новое значение
            
        Returns:
            tuple: (success: bool, error: str|None)
        """
        valid_fields = ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date']
        
        if field not in valid_fields:
            return False, 'Invalid field'

        try:
            # Обработка пустых значений для nullable полей
            if value == '' and field in ['sale_price', 'sale_date']:
                setattr(item, field, None)
            elif field in ['purchase_price', 'sale_price']:
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
        """
        Получить расходы за период.
        
        Args:
            date_from: Дата начала периода
            date_to: Дата конца периода
            
        Returns:
            QuerySet расходов
        """
        expenses = Expense.objects.all()
        
        if date_from:
            expenses = expenses.filter(date__gte=date_from)
        if date_to:
            expenses = expenses.filter(date__lte=date_to)
            
        return expenses

    @staticmethod
    def calculate_total_expenses(expenses):
        """
        Рассчитать сумму расходов.
        
        Args:
            expenses: QuerySet расходов
            
        Returns:
            Общая сумма расходов
        """
        return sum(exp.amount for exp in expenses)

    @staticmethod
    def get_all_expenses_data():
        """
        Получить все расходы в формате для API.
        
        Returns:
            list: Список словарей с данными расходов
        """
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
        
        Args:
            date: Дата расхода
            amount: Сумма расхода
            
        Returns:
            tuple: (expense: Expense|None, error: str|None)
        """
        try:
            expense = Expense.objects.create(
                date=date,
                amount=int(amount)
            )
            return expense, None
        except (ValueError, TypeError) as e:
            return None, str(e)

    @staticmethod
    def update_expense(expense, date=None, amount=None):
        """
        Обновить запись о расходе.
        
        Args:
            expense: Экземпляр Expense
            date: Новая дата (опционально)
            amount: Новая сумма (опционально)
            
        Returns:
            tuple: (success: bool, error: str|None)
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
