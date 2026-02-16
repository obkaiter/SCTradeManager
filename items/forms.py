from django import forms
from .models import Item


class ItemForm(forms.ModelForm):
    class Meta:
        model = Item
        fields = ['name', 'purchase_price', 'sale_price', 'purchase_date', 'sale_date']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Название предмета'}),
            'purchase_price': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Цена покупки'}),
            'sale_price': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Цена продажи'}),
            'purchase_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'sale_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
        }


class SearchForm(forms.Form):
    query = forms.CharField(
        label='',
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Введите название предмета'})
    )
