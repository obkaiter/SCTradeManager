/**
 * Логика редактирования предметов в таблице.
 */

/**
 * Инициализация редактируемых ячеек
 * @param {NodeList} cells - Коллекция редактируемых ячеек
 */
function initEditableCells(cells) {
    cells.forEach(cell => {
        const displayValue = cell.querySelector('.display-value');
        const editInput = cell.querySelector('.edit-input');
        const field = cell.dataset.field;

        if (!displayValue || !editInput) return;

        // Форматируем цену при инициализации
        if (field === 'purchase_price' || field === 'sale_price') {
            const rawValue = editInput.value;
            if (rawValue) {
                editInput.value = formatPrice(rawValue);
            }
        }

        // Выделение текста при фокусе
        editInput.addEventListener('focus', function() {
            if (field === 'purchase_price' || field === 'sale_price') {
                const rawValue = parsePrice(this.value);
                this.value = rawValue;
                this.select();
            }
        });

        // Дабл-клик для редактирования
        cell.addEventListener('dblclick', function() {
            displayValue.style.display = 'none';
            editInput.style.display = 'block';
            editInput.focus();
        });

        // Форматирование при потере фокуса
        editInput.addEventListener('blur', function() {
            if (field === 'purchase_price' || field === 'sale_price') {
                const rawValue = parsePrice(this.value);
                if (rawValue) {
                    this.value = formatPrice(rawValue);
                }
            }
            saveCellValue(cell);
        });

        editInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                editInput.blur();
            }
        });

        editInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                editInput.style.display = 'none';
                displayValue.style.display = 'inline';
            }
        });
    });
}

/**
 * Сохранение значения ячейки на сервер
 * @param {HTMLElement} cell - Редактируемая ячейка
 */
function saveCellValue(cell) {
    const row = cell.closest('tr');
    const itemId = row?.dataset.itemId;
    const field = cell.dataset.field;
    const editInput = cell.querySelector('.edit-input');
    const displayValue = cell.querySelector('.display-value');

    if (!itemId || !editInput || !displayValue) return;

    // Получаем значение
    let newValue = editInput.value;
    if (field === 'purchase_price' || field === 'sale_price') {
        newValue = parsePrice(editInput.value);
    }

    // Если значение не изменилось - выходим
    if (newValue === displayValue.textContent || newValue === parsePrice(displayValue.textContent)) {
        editInput.style.display = 'none';
        displayValue.style.display = 'inline';
        return;
    }

    // Если изменяем цену продажи и дата продажи пустая - выставляем текущую
    if (field === 'sale_price' && newValue !== '') {
        const saleDateCell = row.querySelector('[data-field="sale_date"]');
        const saleDateDisplay = saleDateCell?.querySelector('.display-value');
        const saleDateInput = saleDateCell?.querySelector('.edit-input');

        if (saleDateDisplay && (!saleDateDisplay.textContent || saleDateDisplay.textContent.trim() === '')) {
            const today = new Date().toISOString().split('T')[0];
            const formatted = new Date().toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
            });

            fetch(`/items/${itemId}/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: `field=sale_date&value=${encodeURIComponent(today)}`
            })
            .then(response => response.json())
            .then(dateData => {
                if (dateData.success && saleDateDisplay && saleDateInput) {
                    saleDateDisplay.textContent = formatted;
                    saleDateInput.value = today;
                    return fetch(`/items/${itemId}/update/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        body: `field=${field}&value=${encodeURIComponent(newValue)}`
                    });
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data && data.success) {
                    updateCellDisplay(cell, row, field, data, newValue);
                }
            })
            .catch(error => console.error('Error:', error))
            .finally(() => {
                editInput.style.display = 'none';
                displayValue.style.display = 'inline';
            });

            return;
        }
    }

    // Основной запрос на обновление
    fetch(`/items/${itemId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: `field=${field}&value=${encodeURIComponent(newValue)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateCellDisplay(cell, row, field, data, newValue);
        }
    })
    .catch(error => console.error('Error:', error))
    .finally(() => {
        editInput.style.display = 'none';
        displayValue.style.display = 'inline';
    });
}

/**
 * Обновление отображения ячейки после сохранения
 * @param {HTMLElement} cell - Ячейка
 * @param {HTMLElement} row - Строка таблицы
 * @param {string} field - Поле
 * @param {Object} data - Данные от сервера
 * @param {string} newValue - Новое значение
 */
function updateCellDisplay(cell, row, field, data, newValue) {
    const displayValue = cell.querySelector('.display-value');
    
    if (field === 'purchase_price' || field === 'sale_price') {
        const numValue = parseFloat(data.value) || 0;
        displayValue.textContent = numValue.toLocaleString('ru-RU') + ' ₽';

        const profitCell = row.querySelector('.profit-cell');
        if (data.profit !== undefined) {
            const profitValue = parseFloat(data.profit);
            profitCell.textContent = profitValue.toLocaleString('ru-RU') + ' ₽';

            profitCell.classList.remove('negative-profit', 'positive-profit', 'no-sale-profit');
            if (data.is_negative) {
                profitCell.classList.add('negative-profit');
            } else if (data.profit > 0) {
                profitCell.classList.add('positive-profit');
            }
        } else if (field === 'sale_price' && newValue === '') {
            const purchasePriceCell = row.querySelector('[data-field="purchase_price"]');
            const purchasePrice = parsePrice(purchasePriceCell.querySelector('.display-value').textContent);
            const profitCell = row.querySelector('.profit-cell');
            profitCell.textContent = '-' + formatPrice(purchasePrice);
            profitCell.classList.remove('negative-profit', 'positive-profit');
            profitCell.classList.add('no-sale-profit');
        }
    } else if (field === 'purchase_date' || field === 'sale_date') {
        if (data.value) {
            const date = new Date(data.value);
            const formatted = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
            });
            displayValue.textContent = formatted;
        } else {
            displayValue.textContent = '';
        }
    } else {
        displayValue.textContent = data.value || '';
    }
}
