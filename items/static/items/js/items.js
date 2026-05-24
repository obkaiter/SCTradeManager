/**
 * Логика редактирования предметов в таблице
 */

// Константы
const DELAY_DOUBLE_CLICK = 200;

// Переменные для контекстного меню
let contextMenuCell = null;
let contextMenu = null;
let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener('mousemove', function(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

document.addEventListener('DOMContentLoaded', function() {
    initContextMenuGlobal();
    initCopyOnClick();
});

/**
 * Глобальная инициализация контекстного меню для purchase_price
 */
function initContextMenuGlobal() {
    document.addEventListener('contextmenu', function(e) {
        const target = e.target.closest('.price-cell[data-field="purchase_price"]');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            contextMenuCell = target;
            hideCustomTooltip(); // Скрываем подсказку при показе контекстного меню
            showContextMenu(e.pageX, e.pageY);
            return false;
        }
    });
}

/**
 * Инициализация копирования названия предмета
 */
function initCopyOnClick() {
    let clickTimeout = null;
    let lastClickedCell = null;

    document.addEventListener('click', function(e) {
        const cell = e.target.closest('.copy-on-click[data-field="name"]');
        // Игнорируем ячейки из страницы аналитики цен
        if (cell && cell.dataset.page === 'price-analytics') {
            return;
        }
        if (cell && !e.target.classList.contains('edit-input')) {
            e.preventDefault();
            e.stopPropagation();

            if (lastClickedCell === cell && clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                lastClickedCell = null;
                return;
            }

            if (clickTimeout) clearTimeout(clickTimeout);

            lastClickedCell = cell;
            clickTimeout = setTimeout(() => {
                copyItemName(cell);
                clickTimeout = null;
                lastClickedCell = null;
            }, DELAY_DOUBLE_CLICK);
        }
    });
}

/**
 * Копирование названия предмета в буфер обмена
 */
function copyItemName(cell) {
    const displayValue = cell.querySelector('.display-value');
    if (!displayValue) return;

    const itemName = displayValue.textContent.trim();
    if (!itemName) return;

    navigator.clipboard.writeText(itemName).then(() => {
        cell.classList.add('copied');
        showToast(`"${itemName}" скопировано в буфер обмена`, 'success', 2000);
        setTimeout(() => cell.classList.remove('copied'), 800);
    }).catch(() => {
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
            setTimeout(() => cell.classList.remove('copied'), 800);
        } catch (err) {
            showToast('Не удалось скопировать текст', 'error');
        }
        document.body.removeChild(textArea);
    });
}

/**
 * Инициализация редактируемых ячеек
 */
function initEditableCells(cells) {
    // Инициализация подсказок для цен
    document.querySelectorAll('.price-cell[data-field="purchase_price"], .price-cell[data-field="sale_price"]').forEach(cell => {
        updatePriceCellTooltip(cell);
    });

    cells.forEach(cell => {
        const displayValue = cell.querySelector('.display-value');
        const editInput = cell.querySelector('.edit-input');
        const field = cell.dataset.field;

        if (!displayValue || !editInput) return;

        if (field === 'purchase_price' || field === 'sale_price') {
            cell.addEventListener('mouseenter', function() {
                updatePriceCellTooltip(cell);
                if (cell.getAttribute('data-tooltip')) {
                    showCustomTooltip(cell);
                }
            });

            cell.addEventListener('mousemove', function() {
                const tooltip = document.getElementById('customPurchaseTooltip');
                if (tooltip && cell.getAttribute('data-tooltip')) {
                    tooltip.style.left = lastMouseX + 'px';
                    tooltip.style.top = (lastMouseY + 10) + 'px';
                }
            });

            cell.addEventListener('mouseleave', hideCustomTooltip);
        }

        editInput.addEventListener('focus', function() {
            if (field === 'purchase_price' || field === 'sale_price') {
                this.value = parsePrice(this.value);
                this.select();
            }
        });

        cell.addEventListener('dblclick', function() {
            hideCustomTooltip();
            if (field === 'purchase_price' || field === 'sale_price') {
                editInput.value = parsePrice(displayValue.textContent);
            } else {
                editInput.value = displayValue.textContent;
            }
            displayValue.style.display = 'none';
            editInput.style.display = 'block';
            editInput.focus();
        });

        editInput.addEventListener('blur', function() {
            if (field === 'purchase_price' || field === 'sale_price') {
                const rawValue = parsePrice(this.value);
                if (rawValue) this.value = formatPrice(rawValue);
            }
            saveCellValue(cell);
        });

        editInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') editInput.blur();
        });

        editInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                editInput.style.display = 'none';
                displayValue.style.display = 'inline';
            }
        });
    });

    initContextMenu();
}

/**
 * Сохранение значения ячейки на сервер
 */
function saveCellValue(cell) {
    const row = cell.closest('tr');
    const itemId = row?.dataset.itemId;
    const field = cell.dataset.field;
    const editInput = cell.querySelector('.edit-input');
    const displayValue = cell.querySelector('.display-value');

    if (!itemId || !editInput || !displayValue) return;

    let newValue = editInput.value;
    if (field === 'purchase_price' || field === 'sale_price') {
        newValue = parsePrice(editInput.value);
    }

    // Проверка на изменение
    const currentValue = parsePrice(displayValue.textContent);
    if (newValue === currentValue || newValue === displayValue.textContent) {
        editInput.style.display = 'none';
        displayValue.style.display = 'inline';
        return;
    }

    // Обработка special случаев для sale_price
    if (field === 'sale_price') {
        if (newValue !== '') {
            updateSalePriceWithDate(itemId, row, cell, field, newValue);
        } else {
            clearSalePriceAndDate(itemId, row, cell, newValue);
        }
        return;
    }

    // Основной запрос
    updateItemField(itemId, field, newValue)
        .then(data => {
            if (data.success) {
                updateCellDisplay(cell, row, field, data, newValue);
                if (data.financials) {
                    updateFinancialSummary(data.financials);
                }
                showToast('Изменения сохранены', 'success', 1500);
            } else {
                showToast('Ошибка: ' + (data.error || ''), 'error');
            }
        })
        .catch(() => showToast('Ошибка при сохранении', 'error'))
        .finally(() => {
            editInput.style.display = 'none';
            displayValue.style.display = 'inline';
        });
}

/**
 * Обновление цены продажи с установкой даты
 */
function updateSalePriceWithDate(itemId, row, cell, field, newValue) {
    const saleDateCell = row.querySelector('[data-field="sale_date"]');
    const saleDateDisplay = saleDateCell?.querySelector('.display-value');
    const saleDateInput = saleDateCell?.querySelector('.edit-input');
    const editInput = cell.querySelector('.edit-input');
    const displayValue = cell.querySelector('.display-value');

    if (!saleDateDisplay || saleDateDisplay.textContent.trim() !== '—') {
        // Дата уже установлена, просто обновляем цену
        updateItemField(itemId, field, newValue)
            .then(data => {
                if (data.success) {
                    updateCellDisplay(cell, row, field, data, newValue);
                    if (data.financials) {
                        updateFinancialSummary(data.financials);
                    }
                    showToast('Цена продажи обновлена', 'success', 1500);
                } else {
                    showToast('Ошибка: ' + (data.error || ''), 'error');
                }
            })
            .catch(() => showToast('Ошибка при сохранении', 'error'))
            .finally(() => {
                editInput.style.display = 'none';
                displayValue.style.display = 'inline';
            });
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const formatted = formatDate(new Date());

    const { dateFrom, dateTo } = getDateFilterParams();

    fetch(`/items/${itemId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Date-From': dateFrom,
            'X-Date-To': dateTo
        },
        body: `field=sale_date&value=${encodeURIComponent(today)}`
    })
    .then(r => r.json())
    .then(dateData => {
        if (dateData.success && saleDateDisplay && saleDateInput) {
            saleDateDisplay.textContent = formatted;
            saleDateInput.value = today;
        }
        return updateItemField(itemId, field, newValue);
    })
    .then(data => {
        if (data && data.success) {
            updateCellDisplay(cell, row, field, data, newValue);
            if (data.financials) {
                updateFinancialSummary(data.financials);
            }
            showToast('Цена продажи обновлена', 'success', 1500);
        }
    })
    .catch(() => showToast('Ошибка при сохранении', 'error'))
    .finally(() => {
        editInput.style.display = 'none';
        displayValue.style.display = 'inline';
    });
}

/**
 * Очистка цены продажи и даты продажи
 */
function clearSalePriceAndDate(itemId, row, cell, newValue) {
    const saleDateCell = row.querySelector('[data-field="sale_date"]');
    const saleDateDisplay = saleDateCell?.querySelector('.display-value');
    const saleDateInput = saleDateCell?.querySelector('.edit-input');
    const editInput = cell.querySelector('.edit-input');
    const displayValue = cell.querySelector('.display-value');

    if (!saleDateDisplay || saleDateDisplay.textContent.trim() === '—') {
        // Дата уже пустая, просто очищаем цену
        updateItemField(itemId, 'sale_price', '')
            .then(data => {
                if (data.success) {
                    updateCellDisplay(cell, row, 'sale_price', data, newValue);
                    if (data.financials) {
                        updateFinancialSummary(data.financials);
                    }
                    showToast('Цена продажи очищена', 'success', 1500);
                } else {
                    showToast('Ошибка: ' + (data.error || ''), 'error');
                }
            })
            .catch(() => showToast('Ошибка при сохранении', 'error'))
            .finally(() => {
                editInput.style.display = 'none';
                displayValue.style.display = 'inline';
            });
        return;
    }

    const { dateFrom, dateTo } = getDateFilterParams();

    fetch(`/items/${itemId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Date-From': dateFrom,
            'X-Date-To': dateTo
        },
        body: 'field=sale_date&value='
    })
    .then(r => r.json())
    .then(dateData => {
        if (dateData.success && saleDateDisplay && saleDateInput) {
            saleDateDisplay.textContent = '—';
            saleDateInput.value = '';
        }
        return updateItemField(itemId, 'sale_price', '');
    })
    .then(data => {
        if (data && data.success) {
            updateCellDisplay(cell, row, 'sale_price', data, newValue);
            if (data.financials) {
                updateFinancialSummary(data.financials);
            }
            showToast('Цена продажи и дата продажи очищены', 'success', 1500);
        }
    })
    .catch(() => showToast('Ошибка при сохранении', 'error'))
    .finally(() => {
        editInput.style.display = 'none';
        displayValue.style.display = 'inline';
    });
}

/**
 * Обновление поля предмета
 */
function updateItemField(itemId, field, value) {
    const { dateFrom, dateTo } = getDateFilterParams();
    return fetch(`/items/${itemId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Date-From': dateFrom,
            'X-Date-To': dateTo
        },
        body: `field=${field}&value=${encodeURIComponent(value)}`
    }).then(r => r.json());
}

/**
 * Обновление финансовых показателей в шапке
 */
function updateFinancialSummary(financials) {
    const totalProfitEl = document.getElementById('summaryTotalProfit');
    const totalExpensesEl = document.getElementById('summaryTotalExpenses');
    const reservedAmountEl = document.getElementById('summaryReservedAmount');
    const netProfitEl = document.getElementById('summaryNetProfit');

    if (totalProfitEl) {
        const value = parseFloat(financials.total_profit) || 0;
        totalProfitEl.textContent = value.toLocaleString('ru-RU') + ' ₽';
        totalProfitEl.classList.remove('text-danger', 'text-success');
        if (value < 0) totalProfitEl.classList.add('text-danger');
        else if (value > 0) totalProfitEl.classList.add('text-success');
    }

    if (totalExpensesEl) {
        const value = parseFloat(financials.total_expenses) || 0;
        totalExpensesEl.textContent = '- ' + value.toLocaleString('ru-RU') + ' ₽';
    }

    if (reservedAmountEl) {
        const value = parseFloat(financials.reserved_amount) || 0;
        reservedAmountEl.textContent = value.toLocaleString('ru-RU') + ' ₽';
    }

    if (netProfitEl) {
        const value = parseFloat(financials.net_profit) || 0;
        netProfitEl.textContent = value.toLocaleString('ru-RU') + ' ₽';
        netProfitEl.classList.remove('text-danger', 'text-success');
        if (value < 0) netProfitEl.classList.add('text-danger');
        else if (value > 0) netProfitEl.classList.add('text-success');
    }
}

/**
 * Обновление отображения ячейки
 */
function updateCellDisplay(cell, row, field, data, newValue) {
    const displayValue = cell.querySelector('.display-value');
    const editInput = cell.querySelector('.edit-input');

    if (field === 'purchase_price' || field === 'sale_price') {
        const numValue = parseFloat(data.value) || 0;
        displayValue.textContent = numValue.toLocaleString('ru-RU') + ' ₽';
        if (editInput) editInput.value = numValue.toLocaleString('ru-RU') + ' ₽';
        updateProfitCell(row, field, numValue, data, newValue);
        // Обновляем подсказку цены при изменении покупки или продажи
        updatePriceCellTooltip(cell);
        if (field === 'purchase_price' || field === 'sale_price') {
            if (cell.getAttribute('data-tooltip')) {
                hideCustomTooltip();
                showCustomTooltip(cell);
            }
        }
    } else if (field === 'purchase_date' || field === 'sale_date') {
        if (data.value) {
            displayValue.textContent = formatDate(data.value);
            if (editInput) editInput.value = data.value;
        } else {
            displayValue.textContent = '—';
            if (editInput) editInput.value = '';
        }
    } else if (field === 'quantity') {
        const numValue = parseInt(data.value) || 1;
        displayValue.textContent = numValue;
        if (editInput) editInput.value = numValue;
        updateProfitForQuantity(row, numValue);
        // Обновляем подсказку средней цены при изменении количества
        const purchasePriceCell = row.querySelector('[data-field="purchase_price"]');
        if (purchasePriceCell) {
            updatePriceCellTooltip(purchasePriceCell);
            if (purchasePriceCell.getAttribute('data-tooltip')) {
                hideCustomTooltip();
                showCustomTooltip(purchasePriceCell);
            }
        }
        const salePriceCell = row.querySelector('[data-field="sale_price"]');
        if (salePriceCell) {
            updatePriceCellTooltip(salePriceCell);
        }
    } else {
        displayValue.textContent = data.value || '';
        if (editInput) editInput.value = data.value || '';
    }
}

/**
 * Обновление ячейки прибыли
 */
function updateProfitCell(row, field, numValue, data, newValue) {
    const profitCell = row.querySelector('.profit-cell');

    // Сервер вернул прибыль
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

    // Товар не продан - прибыль = -purchase_price
    if (field === 'sale_price' && newValue === '') {
        const purchasePrice = getPurchasePrice(row);
        profitCell.textContent = '-' + formatPrice(purchasePrice);
        profitCell.classList.remove('negative-profit', 'positive-profit', 'zero-profit');
        profitCell.classList.add('no-sale-profit');
        return;
    }

    // Изменение цены покупки
    if (field === 'purchase_price') {
        const salePrice = getSalePrice(row);
        if (salePrice === null) {
            profitCell.textContent = '-' + formatPrice(numValue);
            profitCell.classList.remove('negative-profit', 'positive-profit', 'zero-profit');
            profitCell.classList.add('no-sale-profit');
        } else {
            const profit = salePrice - numValue;
            profitCell.textContent = profit.toLocaleString('ru-RU') + ' ₽';
            profitCell.classList.remove('negative-profit', 'positive-profit', 'no-sale-profit', 'zero-profit');
            profitCell.classList.add(profit < 0 ? 'negative-profit' : profit > 0 ? 'positive-profit' : 'zero-profit');
        }
    }
}

/**
 * Обновление прибыли при изменении количества
 */
function updateProfitForQuantity(row, quantity) {
    const profitCell = row.querySelector('.profit-cell');
    const purchasePriceCell = row.querySelector('[data-field="purchase_price"]');
    const salePriceCell = row.querySelector('[data-field="sale_price"]');

    if (!profitCell || !purchasePriceCell || !salePriceCell) return;

    const purchasePrice = parseInt(parsePrice(purchasePriceCell.querySelector('.display-value')?.textContent || '0')) || 0;
    const salePriceText = salePriceCell.querySelector('.display-value')?.textContent || '';
    const salePrice = salePriceText ? parseInt(parsePrice(salePriceText)) : null;

    if (salePrice === null) {
        // Товар не продан - показываем минус цену покупки (без учёта количества)
        profitCell.textContent = '-' + formatPrice(purchasePrice);
        profitCell.classList.remove('negative-profit', 'positive-profit', 'zero-profit');
        profitCell.classList.add('no-sale-profit');
    } else {
        // Прибыль считается без учёта количества
        const profit = salePrice - purchasePrice;
        profitCell.textContent = profit.toLocaleString('ru-RU') + ' ₽';
        profitCell.classList.remove('negative-profit', 'positive-profit', 'no-sale-profit', 'zero-profit');
        profitCell.classList.add(profit < 0 ? 'negative-profit' : profit > 0 ? 'positive-profit' : 'zero-profit');
    }
}

/**
 * Получить цену покупки из строки
 */
function getPurchasePrice(row) {
    const cell = row.querySelector('[data-field="purchase_price"]');
    const text = cell?.querySelector('.display-value')?.textContent || '0';
    return parseInt(parsePrice(text)) || 0;
}

/**
 * Получить цену продажи из строки
 */
function getSalePrice(row) {
    const cell = row.querySelector('[data-field="sale_price"]');
    const text = cell?.querySelector('.display-value')?.textContent || '';
    const parsed = parseInt(parsePrice(text));
    return isNaN(parsed) || !text ? null : parsed;
}

/**
 * Обновить всплывающую подсказку для ячейки цены
 */
function updatePriceCellTooltip(cell) {
    if (!cell) return;

    if (cell.dataset.field === 'purchase_price') {
        updateAveragePriceTooltip(cell);
    } else if (cell.dataset.field === 'sale_price') {
        updateSaleUnitProfitTooltip(cell);
    }
}

/**
 * Обновить всплывающую подсказку средней цены для ячейки purchase_price
 */
function updateAveragePriceTooltip(cell) {
    if (cell.dataset.field !== 'purchase_price') return;

    const row = cell.closest('tr');
    const quantityDisplay = row?.querySelector('[data-field="quantity"] .display-value');
    const purchasePriceDisplay = cell.querySelector('.display-value');

    if (!quantityDisplay || !purchasePriceDisplay) return;

    const quantity = parseInt(quantityDisplay.textContent) || 1;
    const purchasePrice = parseInt(parsePrice(purchasePriceDisplay.textContent)) || 0;

    if (quantity > 1) {
        const avgPrice = Math.round(purchasePrice / quantity).toLocaleString('ru-RU');
        cell.setAttribute('data-tooltip', `Средняя цена: ${avgPrice} ₽`);
    } else {
        cell.removeAttribute('data-tooltip');
    }
}

/**
 * Обновить всплывающую подсказку прибыли за штуку для ячейки sale_price
 */
function updateSaleUnitProfitTooltip(cell) {
    if (cell.dataset.field !== 'sale_price') return;

    const row = cell.closest('tr');
    const quantityDisplay = row?.querySelector('[data-field="quantity"] .display-value');
    const purchasePriceDisplay = row?.querySelector('[data-field="purchase_price"] .display-value');
    const salePriceDisplay = cell.querySelector('.display-value');

    if (!quantityDisplay || !purchasePriceDisplay || !salePriceDisplay) return;

    const quantity = parseInt(quantityDisplay.textContent) || 1;
    const purchasePrice = parseInt(parsePrice(purchasePriceDisplay.textContent)) || 0;
    const salePrice = parseInt(parsePrice(salePriceDisplay.textContent)) || 0;

    if (salePrice > 0) {
        const unitProfit = Math.round((salePrice / quantity) - (purchasePrice / quantity)).toLocaleString('ru-RU');
        cell.setAttribute('data-tooltip', `Прибыль (шт.): ${unitProfit} руб.`);
    } else {
        cell.removeAttribute('data-tooltip');
    }
}

/**
 * Показать кастомную всплывающую подсказку
 */
function showCustomTooltip(cell) {
    const tooltip = document.getElementById('customPurchaseTooltip');
    if (tooltip) return; // Уже показана

    if (!cell) {
        cell = document.querySelector('.price-cell[data-tooltip]:hover');
        if (!cell) return;
    }

    const tooltipText = cell.getAttribute('data-tooltip');
    if (!tooltipText) return;

    const newTooltip = document.createElement('div');
    newTooltip.id = 'customPurchaseTooltip';
    newTooltip.style.cssText = `
        position: fixed;
        z-index: 10000;
        pointer-events: none;
        background: rgba(30, 30, 30, 0.95);
        color: #f0f0f0;
        padding: 10px 14px;
        border-radius: 6px;
        border: 1px solid #3e3e42;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        white-space: nowrap;
        left: ${lastMouseX}px;
        top: ${lastMouseY + 10}px;
    `;
    newTooltip.textContent = tooltipText;
    document.body.appendChild(newTooltip);
}

/**
 * Скрыть кастомную всплывающую подсказку
 */
function hideCustomTooltip() {
    const existing = document.getElementById('customPurchaseTooltip');
    if (existing) existing.remove();
}

/**
 * Инициализация контекстного меню
 */
function initContextMenu() {
    contextMenu = document.getElementById('purchasePriceContextMenu');
    if (!contextMenu) return;

    const editItem = document.getElementById('ctxMenuEdit');
    const addItem = document.getElementById('ctxMenuAdd');

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

    addItem.addEventListener('click', function(e) {
        e.stopPropagation();
        hideContextMenu();
        if (contextMenuCell) openAddPriceModal(contextMenuCell);
    });

    document.addEventListener('click', hideContextMenu);
    contextMenu.addEventListener('click', e => e.stopPropagation());
    contextMenu.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
    });
}

/**
 * Показать контекстное меню
 */
function showContextMenu(x, y) {
    if (!contextMenu) return;

    contextMenu.style.display = 'block';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';

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
    if (contextMenu) contextMenu.style.display = 'none';
}

/**
 * Открыть модальное окно добавления к цене покупки
 */
function openAddPriceModal(cell) {
    const displayValue = cell.querySelector('.display-value');
    if (!displayValue) return;

    const currentPrice = parseInt(parsePrice(displayValue.textContent)) || 0;
    const row = cell.closest('tr');
    const quantityCell = row?.querySelector('[data-field="quantity"]');
    const quantityDisplay = quantityCell?.querySelector('.display-value');
    const currentQuantity = quantityDisplay ? parseInt(quantityDisplay.textContent) : 1;
    
    const modal = document.getElementById('addPurchasePriceModal');
    const currentPriceSpan = document.getElementById('currentPurchasePrice');
    const newPriceSpan = document.getElementById('newPurchasePrice');
    const newQuantitySpan = document.getElementById('newQuantity');
    const amountInput = document.getElementById('addPriceAmount');
    const quantityInput = document.getElementById('addQuantityAmount');
    const confirmBtn = document.getElementById('confirmAddPriceBtn');

    if (!modal || !currentPriceSpan || !newPriceSpan || !amountInput || !quantityInput || !confirmBtn) return;

    currentPriceSpan.textContent = formatPrice(currentPrice);
    amountInput.value = '';
    quantityInput.value = '';
    newPriceSpan.textContent = formatPrice(currentPrice);
    newQuantitySpan.textContent = currentQuantity;

    const updateNewValues = () => {
        const addAmount = parseInt(parsePrice(amountInput.value)) || 0;
        const addQuantity = parseInt(quantityInput.value) || 0;
        newPriceSpan.textContent = formatPrice(currentPrice + addAmount);
        newQuantitySpan.textContent = currentQuantity + addQuantity;
    };

    amountInput.removeEventListener('input', updateNewValues);
    amountInput.addEventListener('input', updateNewValues);
    quantityInput.removeEventListener('input', updateNewValues);
    quantityInput.addEventListener('input', updateNewValues);

    const bsModal = new bootstrap.Modal(modal);

    const handleConfirm = () => {
        const addAmount = parseInt(parsePrice(amountInput.value)) || 0;
        const addQuantity = parseInt(quantityInput.value) || 0;

        if (addAmount === 0 && addQuantity === 0) {
            bsModal.hide();
            return;
        }

        const itemId = row?.dataset.itemId;
        if (!itemId) {
            bsModal.hide();
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Сохранение...';

        // Обновляем цену покупки и количество
        const newPrice = currentPrice + addAmount;
        const newQty = currentQuantity + addQuantity;

        // Сначала обновляем цену
        updateItemField(itemId, 'purchase_price', newPrice)
            .then(priceData => {
                if (!priceData.success) {
                    throw new Error(priceData.error || 'Ошибка при обновлении цены');
                }
                // Если количество изменилось, обновляем его
                if (addQuantity > 0) {
                    return updateItemField(itemId, 'quantity', newQty).then(qtyData => ({
                        priceData,
                        qtyData
                    }));
                }
                return { priceData, qtyData: null };
            })
            .then(result => {
                if (result.priceData.success) {
                    updateCellDisplay(cell, row, 'purchase_price', { value: newPrice }, newPrice.toString());
                    if (addQuantity > 0 && quantityCell) {
                        updateCellDisplay(quantityCell, row, 'quantity', { value: newQty }, newQty.toString());
                    }
                    // Обновляем финансовые показатели
                    if (result.priceData.financials) {
                        updateFinancialSummary(result.priceData.financials);
                    }
                    showToast('Цена покупки обновлена', 'success');
                    bsModal.hide();
                } else {
                    showToast('Ошибка: ' + (result.priceData.error || ''), 'error');
                }
            })
            .catch(() => showToast('Ошибка при обновлении', 'error'))
            .finally(() => {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Добавить';
            });
    };

    confirmBtn.removeEventListener('click', handleConfirm);
    confirmBtn.addEventListener('click', handleConfirm);
    bsModal.show();
}
