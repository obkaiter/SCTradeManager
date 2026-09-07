from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import date, timedelta
from items.forms import ItemForm
from items.models import Item, Expense
from items.services import ItemService, ExpenseService


class ItemModelTest(TestCase):
    """Тесты для модели Item."""

    def setUp(self):
        self.today = timezone.now().date()
        self.item = Item.objects.create(
            name='Тестовый предмет',
            purchase_price=1000,
            sale_price=1500,
            purchase_date=self.today,
            sale_date=self.today
        )

    def test_profit_calculation(self):
        """Тест расчёта прибыли."""
        self.assertEqual(self.item.profit, 500)

    def test_profit_no_sale(self):
        """Тест прибыли без продажи."""
        item_no_sale = Item.objects.create(
            name='Без продажи',
            purchase_price=1000,
            purchase_date=self.today
        )
        self.assertIsNone(item_no_sale.profit)

    def test_is_sold_true(self):
        """Тест проданного предмета."""
        self.assertTrue(self.item.is_sold())

    def test_is_sold_false(self):
        """Тест непроданного предмета."""
        item_no_sale = Item.objects.create(
            name='Без продажи',
            purchase_price=1000,
            purchase_date=self.today
        )
        self.assertFalse(item_no_sale.is_sold())

    def test_string_representation(self):
        """Тест строкового представления."""
        self.assertEqual(str(self.item), 'Тестовый предмет')


class ItemFormTest(TestCase):
    """Форма создания содержит только данные новой покупки."""

    def test_sale_fields_are_not_available_when_creating_item(self):
        form = ItemForm()

        self.assertNotIn('sale_price', form.fields)
        self.assertNotIn('sale_date', form.fields)

    def test_submitted_sale_fields_are_ignored(self):
        today = timezone.now().date()
        form = ItemForm(data={
            'name': 'Новый предмет',
            'purchase_price': 1000,
            'purchase_date': today.isoformat(),
            'quantity': 1,
            'sale_price': 1500,
            'sale_date': today.isoformat(),
        })

        self.assertTrue(form.is_valid(), form.errors)
        item = form.save()
        self.assertIsNone(item.sale_price)
        self.assertIsNone(item.sale_date)


class ExpenseModelTest(TestCase):
    """Тесты для модели Expense."""

    def setUp(self):
        self.today = timezone.now().date()
        self.expense = Expense.objects.create(
            date=self.today,
            amount=500
        )

    def test_string_representation(self):
        """Тест строкового представления."""
        self.assertEqual(str(self.expense), f'{self.today} - 500')


class ItemServiceTest(TestCase):
    """Тесты для ItemService."""

    def setUp(self):
        self.today = timezone.now().date()
        self.yesterday = self.today - timedelta(days=1)

        Item.objects.create(
            name='Предмет 1',
            purchase_price=1000,
            sale_price=1500,
            purchase_date=self.today,
            sale_date=self.today
        )
        Item.objects.create(
            name='Предмет 2',
            purchase_price=2000,
            sale_price=1800,
            purchase_date=self.yesterday,
            sale_date=self.today
        )
        Item.objects.create(
            name='Предмет 3',
            purchase_price=1000,
            purchase_date=self.today
        )

    def test_get_items_filtered_by_date(self):
        """Тест фильтрации по дате."""
        items = ItemService.get_items_filtered(date_from=self.today)
        self.assertEqual(items.count(), 3)

    def test_get_items_hide_sold(self):
        """Тест скрытия проданных."""
        items = ItemService.get_items_filtered(hide_sold=True)
        self.assertEqual(items.count(), 1)

    def test_sort_by_profit(self):
        """Тест сортировки по прибыли."""
        items = ItemService.get_items_filtered()
        sorted_items = ItemService.sort_items(items, '-profit')
        
        self.assertEqual(sorted_items[0].profit, 500)
        self.assertEqual(sorted_items[1].profit, -200)

    def test_calculate_total_profit(self):
        """Тест расчёта общей прибыли."""
        items = ItemService.get_items_filtered()
        total_profit = ItemService.calculate_total_profit(items)
        self.assertEqual(total_profit, 300)

    def test_update_item_valid(self):
        """Тест обновления предмета."""
        item = Item.objects.first()
        success, error = ItemService.update_item(item, 'name', 'Новое имя')
        
        self.assertTrue(success)
        self.assertIsNone(error)
        item.refresh_from_db()
        self.assertEqual(item.name, 'Новое имя')

    def test_update_item_invalid_field(self):
        """Тест обновления с неверным полем."""
        item = Item.objects.first()
        success, error = ItemService.update_item(item, 'invalid_field', 'value')
        
        self.assertFalse(success)
        self.assertIsNotNone(error)

    def test_update_item_price_to_none(self):
        """Тест установки цены в None."""
        item = Item.objects.first()
        success, error = ItemService.update_item(item, 'sale_price', '')
        
        self.assertTrue(success)
        item.refresh_from_db()
        self.assertIsNone(item.sale_price)

class ExpenseServiceTest(TestCase):
    """Тесты для ExpenseService."""

    def setUp(self):
        self.today = timezone.now().date()
        self.yesterday = self.today - timedelta(days=1)

        Expense.objects.create(date=self.today, amount=500)
        Expense.objects.create(date=self.yesterday, amount=300)

    def test_get_expenses_in_period(self):
        """Тест получения расходов за период."""
        expenses = ExpenseService.get_expenses_in_period(date_from=self.today)
        self.assertEqual(expenses.count(), 1)

    def test_calculate_total_expenses(self):
        """Тест расчёта общей суммы расходов."""
        expenses = ExpenseService.get_expenses_in_period()
        total = ExpenseService.calculate_total_expenses(expenses)
        self.assertEqual(total, 800)

    def test_get_all_expenses_data(self):
        """Тест получения данных для API."""
        data = ExpenseService.get_all_expenses_data()
        self.assertEqual(len(data), 2)
        self.assertIn('id', data[0])
        self.assertIn('date', data[0])
        self.assertIn('amount', data[0])

    def test_create_expense(self):
        """Тест создания расхода."""
        expense, error = ExpenseService.create_expense(self.today, 1000)
        
        self.assertIsNone(error)
        self.assertIsNotNone(expense)
        self.assertEqual(expense.amount, 1000)

    def test_update_expense(self):
        """Тест обновления расхода."""
        expense = Expense.objects.first()
        success, error = ExpenseService.update_expense(expense, amount=700)
        
        self.assertTrue(success)
        expense.refresh_from_db()
        self.assertEqual(expense.amount, 700)


@override_settings(CACHES={
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'expense-financials-tests',
    },
})
class ExpenseFinancialSummaryTest(TestCase):
    """Сводка сразу отражает изменения расходов после открытия страницы."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.today = timezone.now().date()
        self.yesterday = self.today - timedelta(days=1)
        Item.objects.create(
            name='Проданный предмет',
            purchase_price=1000,
            sale_price=1500,
            purchase_date=self.today,
            sale_date=self.today,
        )

    def assert_summary(self, expenses, date_from=None, date_to=None, profit=500):
        filters = {
            'date_from': (date_from or self.today).isoformat(),
            'date_to': (date_to or self.today).isoformat(),
        }
        for page in ('item_list', 'analytics'):
            with self.subTest(page=page, filters=filters):
                response = self.client.get(reverse(f'items:{page}'), filters)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.context['total_expenses'], expenses)
                self.assertEqual(response.context['total_profit'], profit - expenses)

    def test_delete_expense_refreshes_summary_immediately(self):
        expense = Expense.objects.create(date=self.today, amount=12916439)
        self.assert_summary(12916439)
        self.assert_summary(12916439, date_from=self.yesterday)

        response = self.client.post(
            reverse('items:expense_delete', args=[expense.pk]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertFalse(Expense.objects.filter(pk=expense.pk).exists())
        self.assertEqual(
            self.client.get(reverse('items:expense_list')).json()['expenses'], [],
        )
        self.assert_summary(0)
        self.assert_summary(0, date_from=self.yesterday)

    def test_create_expense_refreshes_summary_immediately(self):
        self.assert_summary(0)

        response = self.client.post(reverse('items:expense_create'), {
            'date': self.today.isoformat(),
            'amount': 12916439,
        })

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assert_summary(12916439)

    def test_update_expense_amount_refreshes_summary_immediately(self):
        expense = Expense.objects.create(date=self.today, amount=12916439)
        self.assert_summary(12916439)

        response = self.client.post(
            reverse('items:expense_update', args=[expense.pk]), {'amount': 700},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assert_summary(700)

    def test_move_expense_refreshes_old_and_new_periods(self):
        expense = Expense.objects.create(date=self.today, amount=12916439)
        self.assert_summary(12916439)
        self.assert_summary(0, self.yesterday, self.yesterday, profit=0)

        response = self.client.post(
            reverse('items:expense_update', args=[expense.pk]),
            {'date': self.yesterday.isoformat()},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assert_summary(0)
        self.assert_summary(12916439, self.yesterday, self.yesterday, profit=0)
