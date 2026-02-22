from django import template

register = template.Library()


@register.filter
def format_price(value):
    """Форматирует цену с разделением на разряды и символом рубля"""
    if value is None or value == '':
        return ''
    try:
        num = int(value)
    except (ValueError, TypeError):
        return str(value)
    # Форматирование с разделением тысяч пробелами и знаком рубля
    return f'{num:,} ₽'.replace(',', ' ')
