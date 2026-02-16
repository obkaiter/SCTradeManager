from django import template

register = template.Library()


@register.filter
def format_price(value):
    """Форматирует цену с символом рубля"""
    if value is None:
        return ''
    return f'{value:,} ₽'.replace(',', ' ')
