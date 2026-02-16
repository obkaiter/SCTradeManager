import os
from datetime import datetime
from django.core.management.base import BaseCommand
from openpyxl import load_workbook
from items.models import Item, Expense


class Command(BaseCommand):
    help = 'Импорт данных из Excel файла p2p.xlsx'

    def handle(self, *args, **kwargs):
        # Путь к файлу
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        excel_path = os.path.join(base_dir, 'p2p.xlsx')
        
        if not os.path.exists(excel_path):
            self.stdout.write(self.style.ERROR(f'Файл {excel_path} не найден'))
            return
        
        # Очищаем базу данных
        self.stdout.write('Очистка базы данных...')
        Item.objects.all().delete()
        Expense.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('База данных очищена'))
        
        # Загружаем Excel
        self.stdout.write(f'Загрузка файла {excel_path}...')
        wb = load_workbook(excel_path, data_only=True)
        
        total_items = 0
        total_expenses = 0
        
        # Проходим по всем листам
        for sheet_name in wb.sheetnames:
            self.stdout.write(f'Обработка листа: {sheet_name}')
            
            # Парсим дату из названия листа
            try:
                # Очищаем название от лишних символов - убираем (!) и пробелы
                clean_name = sheet_name.replace('(!)', '').replace('!', '').strip()
                # Берём первую часть до пробела (на случай если есть лишние символы после даты)
                clean_name = clean_name.split(' ')[0]
                
                # Пробуем разные форматы даты
                purchase_date = None
                for fmt in ['%d.%m.%Y', '%d.%m.%y', '%Y-%m-%d', '%d-%m-%Y']:
                    try:
                        purchase_date = datetime.strptime(clean_name, fmt).date()
                        break
                    except ValueError:
                        continue
                
                if not purchase_date:
                    self.stdout.write(self.style.WARNING(f'  Не удалось распарсить дату из названия листа "{sheet_name}", пропускаем'))
                    continue
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  Ошибка parsing даты: {e}, пропускаем лист'))
                continue
            
            # Получаем лист
            sheet = wb[sheet_name]
            
            # Переменная для накладных расходов с этого листа
            sheet_expense_amount = None
            
            # Проходим по строкам (начиная со 2-й, т.к. 1-я - заголовок)
            for row_idx in range(2, sheet.max_row + 1):
                # Колонка A - проверяем на "Накладные расходы"
                col_a_cell = sheet.cell(row=row_idx, column=1).value
                
                if col_a_cell and str(col_a_cell).strip().lower() == 'накладные расходы:':
                    # Колонка E - сумма расходов
                    expense_cell = sheet.cell(row=row_idx, column=5).value
                    
                    if expense_cell:
                        try:
                            expense_amount = int(float(str(expense_cell).replace(' ', '').replace('₽', '').strip()))
                            sheet_expense_amount = expense_amount
                            self.stdout.write(self.style.SUCCESS(f'  Найдены накладные расходы: {expense_amount} ₽'))
                        except (ValueError, TypeError) as e:
                            self.stdout.write(self.style.WARNING(f'  Ошибка parsing расходов: {e}'))
                    continue  # Пропускаем эту строку как предмет
                
                # Колонка B - название предмета
                name_cell = sheet.cell(row=row_idx, column=2).value
                
                if not name_cell or str(name_cell).strip() == '':
                    continue
                
                name = str(name_cell).strip()
                
                # Колонка C - цена покупки
                purchase_price_cell = sheet.cell(row=row_idx, column=3).value
                if not purchase_price_cell:
                    continue
                try:
                    purchase_price = int(float(str(purchase_price_cell).replace(' ', '').replace('₽', '').strip()))
                except (ValueError, TypeError):
                    self.stdout.write(self.style.WARNING(f'  Неверная цена покупки в строке {row_idx}, пропускаем'))
                    continue
                
                # Колонка D - цена продажи
                sale_price_cell = sheet.cell(row=row_idx, column=4).value
                sale_price = None
                sale_date = None
                
                if sale_price_cell and str(sale_price_cell).strip() != '':
                    try:
                        sale_price = int(float(str(sale_price_cell).replace(' ', '').replace('₽', '').strip()))
                        sale_date = purchase_date  # Дата продажи = дата покупки (дата листа)
                    except (ValueError, TypeError):
                        self.stdout.write(self.style.WARNING(f'  Неверная цена продажи в строке {row_idx}, оставляем пустой'))
                
                # Создаём предмет (без проверки на дубликаты)
                Item.objects.create(
                    name=name,
                    purchase_price=purchase_price,
                    sale_price=sale_price,
                    purchase_date=purchase_date,
                    sale_date=sale_date
                )
                total_items += 1
            
            # Добавляем накладные расходы с этого листа
            if sheet_expense_amount is not None:
                Expense.objects.create(
                    date=purchase_date,
                    amount=sheet_expense_amount
                )
                total_expenses += 1
        
        self.stdout.write(self.style.SUCCESS(f'Импорт завершён! Добавлено предметов: {total_items}, накладных расходов: {total_expenses}'))
        
        wb.close()
