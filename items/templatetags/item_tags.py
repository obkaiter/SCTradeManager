from django import template

register = template.Library()


@register.filter
def format_price(value):
    """Форматирует цену с символом рубля"""
    if value is None:
        return ''
    return f'{value:,} ₽'.replace(',', ' ')


@register.simple_tag
def get_day_counter(items, current_item):
    """Возвращает номер предмета внутри дня (группировка по дате покупки)"""
    counter = 1
    current_date = current_item.purchase_date
    
    for item in items:
        if item == current_item:
            return counter
        if item.purchase_date == current_date:
            counter += 1
        else:
            counter = 1
            current_date = item.purchase_date
    
    return counter
