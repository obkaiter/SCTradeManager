/**
 * Логика редактирования предметов в таблице.
 * Версия 2.0 - улучшенный UX
 */

// Переменные для контекстного меню
let contextMenuCell = null;
let contextMenu = null;

document.addEventListener('DOMContentLoaded', function() {
    // Глобальная блокировка стандартного контекстного меню браузера для ячеек purchase_price
    document.addEventListener('contextmenu', function(e) {
        const target = e.target.closest('.price-cell[data-field="purchase_price"]');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            contextMenuCell = target;
            showContextMenu(e.pageX, e.pageY);
            return false;
        }
    });

    // Обработчик клика для копирования названия предмета
    let clickTimeout = null;
    let lastClickedCell = null;

    document.addEventListener('click', function(e) {
        const cell = e.target.closest('.copy-on-click[data-field="name"]');
        if (cell && !e.target.classList.contains('edit-input')) {
            e.preventDefault();
            e.stopPropagation();

            // Если кликнули по той же ячейке второй раз - это двойной клик, отменяем копирование
            if (lastClickedCell === cell && clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                lastClickedCell = null;
                return;
            }

            // Отменяем предыдущий таймер если был
            if (clickTimeout) {
                clearTimeout(clickTimeout);
            }

            lastClickedCell = cell;

            // Задержка для определения двойного клика
            clickTimeout = setTimeout(function() {
                copyItemName(cell);
                clickTimeout = null;
                lastClickedCell = null;
            }, 200);
        }
    });
});

/**
 * Копирование названия предмета в буфер обмена
 * @param {HTMLElement} cell - Ячейка с названием предмета
 */
function copyItemName(cell) {
    const displayValue = cell.querySelector('.display-value');
    if (!displayValue) return;

    const itemName = displayValue.textContent.trim();
    if (!itemName) return;

    navigator.clipboard.writeText(itemName).then(function() {
        // Визуальная обратная связь
        cell.classList.add('copied');
        showToast(`"${itemName}" скопировано в буфер обмена`, 'success', 2000);
        setTimeout(function() {
            cell.classList.remove('copied');
        }, 800);
    }).catch(function(err) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = itemName;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            cell.classList.add('copied');
            showToast(`"${itemName}" скопировано в буфер обмена`, 'success', 2000);
            setTimeout(function() {
                cell.classList.remove('copied');
            }, 800);
        } catch (err) {
            console.error('Не удалось скопировать текст', err);
            showToast('Не удалось скопировать текст', 'error');
        }
        document.body.removeChild(textArea);
    });
}

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

        // Форматирование при потере фокуса и сохранение
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

    // Если значение не изменилось - закрываем режим редактирования
    const currentValue = parsePrice(displayValue.textContent);
    if (newValue === currentValue || newValue === displayValue.textContent) {
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
            const formatted = formatDate(new Date());

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
                    showToast('Цена продажи обновлена', 'success', 1500);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('Ошибка при сохранении', 'error');
            })
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
            showToast('Изменения сохранены', 'success', 1500);
        } else {
            showToast('Ошибка при сохранении: ' + (data.error || ''), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Ошибка при сохранении', 'error');
    })
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
        if (editInput) {
            editInput.value = numValue.toLocaleString('ru-RU') + ' ₽';
        }

        updateProfitCell(row, field, numValue, data, newValue);
    } else if (field === 'purchase_date' || field === 'sale_date') {
        if (data.value) {
            const formatted = formatDate(data.value);
            displayValue.textContent = formatted;
            if (editInput) {
                editInput.value = data.value;
            }
        } else {
            displayValue.textContent = '—';
            if (editInput) {
                editInput.value = '';
            }
        }
    } else {
        displayValue.textContent = data.value || '';
        if (editInput) {
            editInput.value = data.value || '';
        }
    }
}

/**
 * Обновление ячейки прибыли
 * @param {HTMLElement} row - Строка таблицы
 * @param {string} field - Изменённое поле
 * @param {number} numValue - Числовое значение цены
 * @param {Object} data - Данные от сервера
 * @param {string} newValue - Новое значение
 */
function updateProfitCell(row, field, numValue, data, newValue) {
    const profitCell = row.querySelector('.profit-cell');

    // Если сервер вернул прибыль - используем её
    if (data.profit !== undefined && data.profit !== '' && data.profit !== null) {
        const profitValue = parseFloat(data.profit);
        profitCell.textContent = profitValue.toLocaleString('ru-RU') + ' ₽';
        profitCell.classList.remove('negative-profit', 'positive-profit', 'no-sale-profit', 'zero-profit');
        if (data.is_negative || profitValue < 0) {
            profitCell.classList.add('negative-profit');
        } else if (profitValue > 0) {
            profitCell.classList.add('positive-profit');
        } else if (profitValue === 0) {
            profitCell.classList.add('zero-profit');
        }
        return;
    }

    // Товар не продан (sale_price пустой)
    if (field === 'sale_price' && newValue === '') {
        profitCell.textContent = '-' + formatPrice(numValue);
        profitCell.classList.remove('negative-profit', 'positive-profit');
        profitCell.classList.add('no-sale-profit');
        return;
    }

    // Изменение цены покупки
    if (field === 'purchase_price') {
        const salePriceCell = row.querySelector('[data-field="sale_price"]');
        const salePriceText = salePriceCell?.querySelector('.display-value')?.textContent || '';
        const salePrice = parseInt(parsePrice(salePriceText)) || null;

        if (salePrice === null || salePriceText === '') {
            // Товар не продан
            profitCell.textContent = '-' + formatPrice(numValue);
            profitCell.classList.remove('negative-profit', 'positive-profit', 'zero-profit');
            profitCell.classList.add('no-sale-profit');
        } else {
            // Товар продан
            const profit = salePrice - numValue;
            profitCell.textContent = profit.toLocaleString('ru-RU') + ' ₽';
            profitCell.classList.remove('negative-profit', 'positive-profit', 'no-sale-profit', 'zero-profit');
            if (profit < 0) {
                profitCell.classList.add('negative-profit');
            } else if (profit > 0) {
                profitCell.classList.add('positive-profit');
            } else {
                profitCell.classList.add('zero-profit');
            }
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

    // Пункт "Изменить"
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

    // Пункт "Добавить"
    addItem.addEventListener('click', function(e) {
        e.stopPropagation();
        hideContextMenu();
        if (contextMenuCell) {
            openAddPriceModal(contextMenuCell);
        }
    });

    // Закрытие контекстного меню при клике вне его
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

    const currentPrice = parseInt(parsePrice(displayValue.textContent)) || 0;

    const modal = document.getElementById('addPurchasePriceModal');
    const currentPriceSpan = document.getElementById('currentPurchasePrice');
    const newPriceSpan = document.getElementById('newPurchasePrice');
    const amountInput = document.getElementById('addPriceAmount');
    const confirmBtn = document.getElementById('confirmAddPriceBtn');

    if (!modal || !currentPriceSpan || !newPriceSpan || !amountInput || !confirmBtn) return;

    // Отображаем текущую цену
    currentPriceSpan.textContent = formatPrice(currentPrice);

    // Сбрасываем поле ввода
    amountInput.value = '';
    newPriceSpan.textContent = '';

    // Обновляем новую цену при вводе
    const updateNewPrice = () => {
        const addAmount = parseInt(parsePrice(amountInput.value)) || 0;
        const newPrice = currentPrice + addAmount;
        newPriceSpan.textContent = formatPrice(newPrice);
    };

    amountInput.removeEventListener('input', updateNewPrice);
    amountInput.addEventListener('input', updateNewPrice);

    const bsModal = new bootstrap.Modal(modal);

    // Обработчик кнопки "Добавить"
    const handleConfirm = () => {
        const addAmount = parseInt(parsePrice(amountInput.value)) || 0;
        if (addAmount === 0) {
            bsModal.hide();
            return;
        }

        const newPrice = currentPrice + addAmount;
        const row = cell.closest('tr');
        const itemId = row?.dataset.itemId;

        if (!itemId) {
            bsModal.hide();
            return;
        }

        // Блокировка кнопки
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Сохранение...';

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
                showToast('Цена покупки обновлена', 'success');
                bsModal.hide();
            } else {
                showToast('Ошибка при обновлении: ' + (data.error || ''), 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Ошибка при обновлении', 'error');
        })
        .finally(() => {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Добавить';
        });
    };

    confirmBtn.removeEventListener('click', handleConfirm);
    confirmBtn.addEventListener('click', handleConfirm);
    bsModal.show();
}
