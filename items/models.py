from django.db import models


class Item(models.Model):
    name = models.CharField("Название предмета", max_length=255)
    purchase_price = models.IntegerField("Цена покупки")
    sale_price = models.IntegerField("Цена продажи", null=True, blank=True)
    purchase_date = models.DateField("Дата покупки")
    sale_date = models.DateField("Дата продажи", null=True, blank=True)
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
    date = models.DateField("Дата")
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
