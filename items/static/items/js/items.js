/**
 * Логика редактирования предметов в таблице.
 */

// Переменные для контекстного меню
let contextMenuCell = null;
let contextMenu = null;

// Блокировка стандартного контекстного меню браузера
document.addEventListener('contextmenu', function(e) {
    // Проверяем, что клик по ячейке с ценой покупки
    const target = e.target.closest('.price-cell[data-field="purchase_price"]');
    if (target) {
        e.preventDefault();
        e.stopPropagation();
        contextMenuCell = target;
        showContextMenu(e.pageX, e.pageY);
        return false;
    }
});

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
            // Синхронизируем значение input с текущим отображаемым значением
            if (field === 'purchase_price' || field === 'sale_price') {
                const rawValue = parsePrice(displayValue.textContent);
                editInput.value = rawValue;
            } else {
                editInput.value = displayValue.textContent;
            }
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

    // Инициализация контекстного меню
    initContextMenu();
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
    const editInput = cell.querySelector('.edit-input');

    if (field === 'purchase_price' || field === 'sale_price') {
        const numValue = parseFloat(data.value) || 0;
        displayValue.textContent = numValue.toLocaleString('ru-RU') + ' ₽';
        // Обновляем также значение в input для последующего редактирования
        if (editInput) {
            editInput.value = numValue.toLocaleString('ru-RU') + ' ₽';
        }

        const profitCell = row.querySelector('.profit-cell');
        // Проверяем, что profit существует и не пустая строка
        if (data.profit !== undefined && data.profit !== '' && data.profit !== null) {
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
        } else if (field === 'purchase_price') {
            // При изменении цены покупки пересчитываем прибыль
            const salePriceCell = row.querySelector('[data-field="sale_price"]');
            const salePriceText = salePriceCell?.querySelector('.display-value')?.textContent || '';
            const salePrice = parseInt(parsePrice(salePriceText)) || null;
            
            if (salePrice === null || salePriceText === '') {
                // Товар не продан - прибыль = -purchase_price
                profitCell.textContent = '-' + formatPrice(numValue);
                profitCell.classList.remove('negative-profit', 'positive-profit');
                profitCell.classList.add('no-sale-profit');
            } else {
                // Товар продан - прибыль = sale_price - purchase_price
                const profit = salePrice - numValue;
                profitCell.textContent = profit.toLocaleString('ru-RU') + ' ₽';
                profitCell.classList.remove('negative-profit', 'positive-profit', 'no-sale-profit');
                if (profit < 0) {
                    profitCell.classList.add('negative-profit');
                } else if (profit > 0) {
                    profitCell.classList.add('positive-profit');
                }
            }
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
            // Обновляем также значение в input
            if (editInput) {
                editInput.value = data.value;
            }
        } else {
            displayValue.textContent = '';
            if (editInput) {
                editInput.value = '';
            }
        }
    } else {
        displayValue.textContent = data.value || '';
        // Обновляем также значение в input
        if (editInput) {
            editInput.value = data.value || '';
        }
    }
}

/**
 * Инициализация контекстного меню
 */
function initContextMenu() {
    contextMenu = document.getElementById('purchasePriceContextMenu');
    if (!contextMenu) return;

    const editItem = document.getElementById('ctxMenuEdit');
    const addItem = document.getElementById('ctxMenuAdd');

    // Пункт "Изменить" - открывает стандартное редактирование
    editItem.addEventListener('click', function(e) {
        e.stopPropagation();
        hideContextMenu();
        if (contextMenuCell) {
            const displayValue = contextMenuCell.querySelector('.display-value');
            const editInput = contextMenuCell.querySelector('.edit-input');
            if (displayValue && editInput) {
                displayValue.style.display = 'none';
                editInput.style.display = 'block';
                editInput.focus();
            }
        }
    });

    // Пункт "Добавить" - открывает модальное окно
    addItem.addEventListener('click', function(e) {
        e.stopPropagation();
        hideContextMenu();
        if (contextMenuCell) {
            openAddPriceModal(contextMenuCell);
        }
    });

    // Закрытие контекстного меню при клике в любом месте
    document.addEventListener('click', function() {
        hideContextMenu();
    });

    // Предотвращаем всплытие клика по контекстному меню
    contextMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    contextMenu.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
}

/**
 * Показать контекстное меню
 * @param {number} x - Координата X
 * @param {number} y - Координата Y
 */
function showContextMenu(x, y) {
    if (!contextMenu) return;

    contextMenu.style.display = 'block';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';

    // Проверка выхода за границы экрана
    const rect = contextMenu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
        contextMenu.style.left = (x - rect.width) + 'px';
    }
    if (y + rect.height > window.innerHeight) {
        contextMenu.style.top = (y - rect.height) + 'px';
    }
}

/**
 * Скрыть контекстное меню
 */
function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

/**
 * Открыть модальное окно добавления значения к цене покупки
 * @param {HTMLElement} cell - Ячейка с ценой покупки
 */
function openAddPriceModal(cell) {
    const displayValue = cell.querySelector('.display-value');
    if (!displayValue) return;

    const currentPriceText = displayValue.textContent;
    const currentPrice = parsePrice(currentPriceText);
    const currentPriceNum = parseInt(currentPrice) || 0;

    const modal = document.getElementById('addPurchasePriceModal');
    const currentPriceSpan = document.getElementById('currentPurchasePrice');
    const newPriceSpan = document.getElementById('newPurchasePrice');
    const amountInput = document.getElementById('addPriceAmount');
    const confirmBtn = document.getElementById('confirmAddPriceBtn');

    if (!modal || !currentPriceSpan || !newPriceSpan || !amountInput || !confirmBtn) return;

    // Отображаем текущую цену
    currentPriceSpan.textContent = formatPrice(currentPriceNum);

    // Сбрасываем поле ввода
    amountInput.value = '';
    newPriceSpan.textContent = '';

    // Обновляем новую цену при вводе
    amountInput.addEventListener('input', function() {
        const addAmount = parseInt(parsePrice(this.value)) || 0;
        const newPrice = currentPriceNum + addAmount;
        newPriceSpan.textContent = formatPrice(newPrice);
    });

    // Создаем модальное окно Bootstrap
    const bsModal = new bootstrap.Modal(modal);

    // Обработчик кнопки "Добавить"
    const handleConfirm = function() {
        const addAmount = parseInt(parsePrice(amountInput.value)) || 0;
        if (addAmount === 0) {
            bsModal.hide();
            return;
        }

        const newPrice = currentPriceNum + addAmount;
        const row = cell.closest('tr');
        const itemId = row?.dataset.itemId;

        if (!itemId) {
            bsModal.hide();
            return;
        }

        // Отправляем запрос на сервер
        fetch(`/items/${itemId}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: `field=purchase_price&value=${encodeURIComponent(newPrice)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateCellDisplay(cell, row, 'purchase_price', data, newPrice.toString());
            }
        })
        .catch(error => console.error('Error:', error))
        .finally(() => {
            bsModal.hide();
            // Удаляем обработчик, чтобы не дублировался
            confirmBtn.removeEventListener('click', handleConfirm);
        });
    };

    confirmBtn.addEventListener('click', handleConfirm);
    bsModal.show();
}
