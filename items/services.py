"""
Сервисный слой для бизнес-логики предметов и расходов.
"""
from django.db.models import Q, Sum, F
from django.core.cache import cache
from django.conf import settings
import urllib.request
import ssl
import json
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
            # Оптимизированная сортировка по прибыли через annotate
            items = items.annotate(
                _profit=Sum(F('sale_price') - F('purchase_price'))
            ).order_by(sort_by.replace('profit', '_profit'))
            return items

        if sort_by and sort_by.lstrip('-') in valid_sort_fields:
            return items.order_by(sort_by)

        return items.order_by('-purchase_date')

    @staticmethod
    def calculate_total_profit(items):
        """Рассчитать суммарную прибыль через агрегацию в БД."""
        result = items.aggregate(
            total=Sum(F('sale_price') - F('purchase_price'))
        )['total']
        return result or 0

    @staticmethod
    def calculate_reserved_amount(items):
        """
        Рассчитать сумму зарезервированных предметов.
        items должен быть отфильтрован по sale_date__isnull=True
        """
        result = items.aggregate(total=Sum('purchase_price'))['total']
        return result or 0

    @staticmethod
    def calculate_financials_fast(date_from, date_to):
        """
        Быстрый расчёт финансовых показателей за период.
        Использует агрегацию в БД вместо итерации в Python.
        Returns: dict с financial metrics
        """
        cache_key = f'financials_{date_from}_{date_to}'
        cached_result = cache.get(cache_key)
        if cached_result:
            return cached_result

        # Прибыль от продаж
        sold_items = Item.objects.filter(
            sale_date__isnull=False,
            sale_date__gte=date_from,
            sale_date__lte=date_to
        )
        
        sales_total = sold_items.aggregate(total=Sum('sale_price'))['total'] or 0
        gross_profit = sold_items.aggregate(
            total=Sum(F('sale_price') - F('purchase_price'))
        )['total'] or 0

        # Расходы
        total_expenses = Expense.objects.filter(
            date__gte=date_from,
            date__lte=date_to
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Зарезервировано
        reserved_amount = Item.objects.filter(
            sale_date__isnull=True,
            purchase_date__gte=date_from,
            purchase_date__lte=date_to
        ).aggregate(total=Sum('purchase_price'))['total'] or 0

        # Оборот (только продажи)
        turnover = sales_total

        # Чистая прибыль
        net_profit = gross_profit - total_expenses

        result = {
            'gross_profit': gross_profit,
            'total_profit': net_profit,  # Для обратной совместимости
            'total_expenses': total_expenses,
            'reserved_amount': reserved_amount,
            'turnover': turnover,
            'net_profit': net_profit,
        }

        cache.set(cache_key, result, timeout=60)  # Кэшируем на 1 минуту
        return result

    @staticmethod
    def get_daily_profit_data(date_from, date_to):
        """
        Получить данные о прибыли по дням.
        Returns: list of dict с date и profit
        """
        from django.db.models import Func, Value
        from django.db.models.functions import Cast
        from django.db.models import DateField
        
        # Для SQLite используем DATE() функцию
        data = Item.objects.filter(
            sale_date__isnull=False,
            sale_date__gte=date_from,
            sale_date__lte=date_to
        ).annotate(
            profit=F('sale_price') - F('purchase_price')
        ).values('sale_date').annotate(
            total_profit=Sum('profit'),
            total_sales=Sum('sale_price'),
            count=Sum('quantity')
        ).order_by('sale_date')

        # Преобразуем в нужный формат
        result = []
        for item in data:
            result.append({
                'date': item['sale_date'],
                'total_profit': item['total_profit'] or 0,
                'total_sales': item['total_sales'] or 0,
                'count': item['count'] or 0,
            })

        return result

    @staticmethod
    def get_items_profit_by_name(date_from, date_to):
        """
        Получить прибыль по предметам (группировка по названию).
        Returns: list of dict с name, total_profit, count, avg_profit
        """
        # Фильтруем только предметы с ненулевой прибылью
        data = Item.objects.filter(
            sale_date__isnull=False,
            sale_price__isnull=False,
            sale_date__gte=date_from,
            sale_date__lte=date_to
        ).annotate(
            profit=F('sale_price') - F('purchase_price')
        ).values('name').annotate(
            total_profit=Sum('profit'),
            total_count=Sum('quantity')
        ).filter(
            total_profit__isnull=False
        ).order_by('-total_profit')

        result = []
        for item in data:
            total_profit = item['total_profit'] or 0
            total_count = item['total_count'] or 0
            
            # Пропускаем предметы с нулевым количеством
            if total_count == 0:
                continue
            
            # Средняя прибыль = общая прибыль / количество
            avg_profit = total_profit / total_count
            
            result.append({
                'name': item['name'],
                'count': total_count,
                'total_profit': total_profit,
                'avg_profit': avg_profit,
            })

        return result

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
        """Рассчитать сумму расходов через агрегацию в БД."""
        result = expenses.aggregate(total=Sum('amount'))['total']
        return result or 0

    @staticmethod
    def get_daily_expenses_data(date_from, date_to):
        """
        Получить расходы по дням.
        Returns: dict {date: total_amount}
        """
        data = Expense.objects.filter(
            date__gte=date_from,
            date__lte=date_to
        ).values('date').annotate(
            total=Sum('amount')
        ).order_by('date')
        
        return {item['date']: item['total'] or 0 for item in data}

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


class PriceCheckService:
    """Сервис для парсинга цен с сайта stagnate.ru."""

    API_URL = "https://www.stagnate.ru/api/pricecheck-pivot"

    @staticmethod
    def _fetch_api_data() -> list | None:
        """Получает данные из API stagnate.ru"""
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "ru-RU,ru;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
        }

        try:
            req = urllib.request.Request(PriceCheckService.API_URL, headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
                data = response.read().decode('utf-8')
            return json.loads(data)
        except Exception:
            return None

    @staticmethod
    def get_price_24h(item_name: str) -> tuple:
        """
        Получает цену и количество продаж предмета за сутки с сайта stagnate.ru.

        Args:
            item_name: Название предмета

        Returns:
            Кортеж (price_24h, amount_24h) или (None, None) если не найдено
        """
        json_data = PriceCheckService._fetch_api_data()
        if not json_data:
            return None, None

        item_name_lower = item_name.lower()

        for item in json_data:
            if not isinstance(item, dict) or 'name' not in item:
                continue

            name = item.get('name', '')

            # Точное совпадение названия
            if name.lower() == item_name_lower:
                return item.get('hours_024_median'), item.get('hours_024_amount')

        # Если точное совпадение не найдено, ищем частичное
        for item in json_data:
            if not isinstance(item, dict) or 'name' not in item:
                continue

            name = item.get('name', '')
            if item_name_lower in name.lower():
                return item.get('hours_024_median'), item.get('hours_024_amount')

        return None, None

    @staticmethod
    def get_all_prices(item_names: list) -> dict:
        """
        Получает цены для списка предметов.

        Args:
            item_names: Список названий предметов

        Returns:
            dict {name: price_24h} для найденных, {name: None} для не найденных
        """
        json_data = PriceCheckService._fetch_api_data()
        if not json_data:
            return {name: None for name in item_names}

        results = {}
        item_names_lower = {name.lower(): name for name in item_names}

        for item in json_data:
            if not isinstance(item, dict) or 'name' not in item:
                continue

            api_name = item.get('name', '')
            api_name_lower = api_name.lower()

            # Ищем совпадения
            for search_lower, original_name in item_names_lower.items():
                if api_name_lower == search_lower:
                    results[original_name] = item.get('hours_024_median')
                    break
                elif search_lower in api_name_lower and original_name not in results:
                    results[original_name] = item.get('hours_024_median')

        # Добавляем None для не найденных
        for name in item_names:
            if name not in results:
                results[name] = None

        return results
