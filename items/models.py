from django.db import models


class Item(models.Model):
    name = models.CharField("Название предмета", max_length=255)
    purchase_price = models.IntegerField("Цена покупки")
    sale_price = models.IntegerField("Цена продажи", null=True, blank=True)
    purchase_date = models.DateField("Дата покупки")
    sale_date = models.DateField("Дата продажи", null=True, blank=True)

    class Meta:
        verbose_name = "Предмет"
        verbose_name_plural = "Предметы"
        ordering = ['-purchase_date']

    def __str__(self):
        return self.name

    @property
    def profit(self):
        if self.sale_price is not None:
            return self.sale_price - self.purchase_price
        return None

    def is_sold(self):
        return self.sale_date is not None and self.sale_price is not None


class Expense(models.Model):
    date = models.DateField("Дата")
    amount = models.IntegerField("Сумма")

    class Meta:
        verbose_name = "Непредвиденные расходы"
        verbose_name_plural = "Непредвиденные расходы"
        ordering = ['-date']

    def __str__(self):
        return f"{self.date} - {self.amount}"
