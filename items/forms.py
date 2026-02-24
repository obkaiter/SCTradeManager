from django import forms
from django.utils import timezone
from .models import Item


class ItemForm(forms.ModelForm):
    class Meta:
        model = Item
        fields = ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date', 'quantity']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Название предмета'}),
            'purchase_price': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Цена покупки'}),
            'sale_price': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Цена продажи'}),
            'purchase_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'sale_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'quantity': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Количество', 'min': '1'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance.pk and 'purchase_date' not in self.initial:
            self.fields['purchase_date'].initial = timezone.now().date()
        if not self.instance.pk and 'quantity' not in self.initial:
            self.fields['quantity'].initial = 1
