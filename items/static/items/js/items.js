/**
 * Логика редактирования предметов в таблице
 */

// Константы
const DELAY_DOUBLE_CLICK = 200;
const DELAY_PAGE_RELOAD = 600;

// Переменные для контекстного меню
let contextMenuCell = null;
let contextMenu = null;

document.addEventListener('DOMContentLoaded', function() {
    // Восстанавливаем позицию скролла мгновенно
    const scrollPosition = sessionStorage.getItem('scrollPosition');
    if (scrollPosition) {
        window.scrollTo({ top: parseInt(scrollPosition), behavior: 'instant' });
        sessionStorage.removeItem('scrollPosition');
    }
    
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
    cells.forEach(cell => {
        const displayValue = cell.querySelector('.display-value');
        const editInput = cell.querySelector('.edit-input');
        const field = cell.dataset.field;

        if (!displayValue || !editInput) return;

        // Фокус - выделение
        editInput.addEventListener('focus', function() {
            if (field === 'purchase_price' || field === 'sale_price') {
                this.value = parsePrice(this.value);
                this.select();
            }
        });

        // Дабл-клик для редактирования
        cell.addEventListener('dblclick', function() {
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

        // Blur - сохранение
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
                showToast('Изменения сохранены', 'success', 1500);
                reloadPageWithParams();
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
            .then(handleUpdateResponse(cell, row, field, newValue, 'Цена продажи обновлена'))
            .catch(handleUpdateError(editInput, displayValue));
        return;
    }

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
            showToast('Цена продажи обновлена', 'success', 1500);
            reloadPageWithParams();
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
            .then(handleUpdateResponse(cell, row, 'sale_price', '', 'Цена продажи очищена'))
            .catch(handleUpdateError(editInput, displayValue));
        return;
    }

    fetch(`/items/${itemId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')
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
            showToast('Цена продажи и дата продажи очищены', 'success', 1500);
            reloadPageWithParams();
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
    return fetch(`/items/${itemId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: `field=${field}&value=${encodeURIComponent(value)}`
    }).then(r => r.json());
}

/**
 * Обработчик успешного ответа
 */
function handleUpdateResponse(cell, row, field, newValue, message) {
    return data => {
        if (data.success) {
            updateCellDisplay(cell, row, field, data, newValue);
            showToast(message, 'success', 1500);
            reloadPageWithParams();
        } else {
            showToast('Ошибка: ' + (data.error || ''), 'error');
        }
    };
}

/**
 * Обработчик ошибки
 */
function handleUpdateError(editInput, displayValue) {
    return () => {
        showToast('Ошибка при сохранении', 'error');
        editInput.style.display = 'none';
        displayValue.style.display = 'inline';
    };
}

/**
 * Перезагрузка страницы с сохранением параметров и позиции скролла
 */
function reloadPageWithParams() {
    // Сохраняем позицию скролла в sessionStorage
    const scrollPosition = window.scrollY;
    sessionStorage.setItem('scrollPosition', scrollPosition.toString());
    
    setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        window.location.href = '?' + urlParams.toString();
    }, DELAY_PAGE_RELOAD);
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
    const modal = document.getElementById('addPurchasePriceModal');
    const currentPriceSpan = document.getElementById('currentPurchasePrice');
    const newPriceSpan = document.getElementById('newPurchasePrice');
    const amountInput = document.getElementById('addPriceAmount');
    const confirmBtn = document.getElementById('confirmAddPriceBtn');

    if (!modal || !currentPriceSpan || !newPriceSpan || !amountInput || !confirmBtn) return;

    currentPriceSpan.textContent = formatPrice(currentPrice);
    amountInput.value = '';
    newPriceSpan.textContent = '';

    const updateNewPrice = () => {
        const addAmount = parseInt(parsePrice(amountInput.value)) || 0;
        newPriceSpan.textContent = formatPrice(currentPrice + addAmount);
    };

    amountInput.removeEventListener('input', updateNewPrice);
    amountInput.addEventListener('input', updateNewPrice);

    const bsModal = new bootstrap.Modal(modal);

    const handleConfirm = () => {
        const addAmount = parseInt(parsePrice(amountInput.value)) || 0;
        if (addAmount === 0) {
            bsModal.hide();
            return;
        }

        const row = cell.closest('tr');
        const itemId = row?.dataset.itemId;
        if (!itemId) {
            bsModal.hide();
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Сохранение...';

        updateItemField(itemId, 'purchase_price', currentPrice + addAmount)
            .then(data => {
                if (data.success) {
                    updateCellDisplay(cell, row, 'purchase_price', data, (currentPrice + addAmount).toString());
                    showToast('Цена покупки обновлена', 'success');
                    bsModal.hide();
                } else {
                    showToast('Ошибка: ' + (data.error || ''), 'error');
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
