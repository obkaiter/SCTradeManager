from django.db import models
from django.utils import timezone


class Item(models.Model):
    name = models.CharField("Название предмета", max_length=255, db_index=True)
    purchase_price = models.IntegerField("Цена покупки")
    sale_price = models.IntegerField("Цена продажи", null=True, blank=True, db_index=True)
    purchase_date = models.DateField("Дата покупки", db_index=True)
    sale_date = models.DateField("Дата продажи", null=True, blank=True, db_index=True)
    quantity = models.PositiveIntegerField("Количество", default=1)

    class Meta:
        verbose_name = "Предмет"
        verbose_name_plural = "Предметы"
        ordering = ['-purchase_date']
        indexes = [
            models.Index(fields=['purchase_date']),
            models.Index(fields=['sale_date']),
            models.Index(fields=['name']),
            models.Index(fields=['purchase_date', 'sale_date']),
            models.Index(fields=['sale_price']),
            models.Index(fields=['sale_date', 'sale_price']),
        ]

    def __str__(self):
        return self.name

    @property
    def profit(self):
        """Прибыль считается как разница между ценой продажи и покупки (без учёта количества)."""
        if self.sale_price is not None:
            return self.sale_price - self.purchase_price
        return None

    def is_sold(self):
        return self.sale_date is not None and self.sale_price is not None


class Expense(models.Model):
    date = models.DateField("Дата", db_index=True)
    amount = models.IntegerField("Сумма")

    class Meta:
        verbose_name = "Накладные расходы"
        verbose_name_plural = "Накладные расходы"
        ordering = ['-date']
        indexes = [
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f"{self.date} - {self.amount}"


class FleshPrice(models.Model):
    """Модель для хранения цен закупки мякоти."""
    solovik = models.IntegerField("Мякоть солевика", default=0)
    slastena = models.IntegerField("Мякоть сластены", default=0)
    kubarbuz = models.IntegerField("Мякоть куборбуза", default=0)
    limonnik = models.IntegerField("Мякоть лимонника", default=0)
    comment = models.TextField("Комментарий", blank=True, default="")

    class Meta:
        verbose_name = "Цены закупки мякоти"
        verbose_name_plural = "Цены закупки мякоти"

    def __str__(self):
        return f"Цены мякоти (солевик: {self.solovik}, сластёна: {self.slastena}, кубарбуз: {self.kubarbuz}, лимонник: {self.limonnik})"

    @classmethod
    def get_prices(cls):
        """Получить текущие цены или создать запись по умолчанию."""
        instance = cls.objects.first()
        if not instance:
            instance = cls.objects.create()
        return instance


class PriceItem(models.Model):
    """Модель для хранения предметов в аналитике цен."""
    name = models.CharField("Название предмета", max_length=255, db_index=True, unique=True)
    price_24h = models.IntegerField("Цена за сутки", null=True, blank=True)
    amount_24h = models.IntegerField("Количество продаж за сутки", null=True, blank=True)
    created_at = models.DateTimeField("Дата добавления", auto_now_add=True)
    updated_at = models.DateTimeField("Дата обновления", auto_now=True)

    class Meta:
        verbose_name = "Предмет для анализа цен"
        verbose_name_plural = "Предметы для анализа цен"
        ordering = ['name']

    def __str__(self):
        return self.name
