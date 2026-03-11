/**
 * Скрипт для страницы аналитики цен
 */
(function() {
    // Переменные для копирования
    const DELAY_DOUBLE_CLICK = 200;
    let clickTimeout = null;
    let lastClickedCell = null;

    document.addEventListener('DOMContentLoaded', function() {
        // Инициализация форматирования цен
        initPriceFields([]);

        // Добавление предмета
        initAddPriceItem();

        // Удаление предмета
        initDeletePriceItem();

        // Обновление цен
        initRefreshPrices();

        // Сортировка по клику на заголовок
        initSorting();

        // Копирование названия по клику
        initCopyOnClick();
    });

    /**
     * Инициализация копирования названия предмета
     */
    function initCopyOnClick() {
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
 * Инициализация сортировки
 */
function initSorting() {
    const table = document.getElementById('priceItemsTable');
    if (!table) return;

    table.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const field = this.dataset.sort;
            const currentSort = table.dataset.currentSort || '';
            let newSort;

            if (currentSort === field) {
                newSort = '-' + field;
            } else if (currentSort === '-' + field) {
                newSort = field;
            } else {
                newSort = field;
            }

            // Получаем текущие параметры из URL
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('sort', newSort);
            window.location.href = '?' + urlParams.toString();
        });
    });
}

/**
 * Инициализация добавления предмета
 */
function initAddPriceItem() {
    const form = document.getElementById('addPriceItemForm');
    const modalElement = document.getElementById('addPriceItemModal');
    if (!form || !modalElement) return;

    const modal = new bootstrap.Modal(modalElement);

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const nameInput = document.getElementById('addPriceItemName');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Добавление...';
        }

        const formData = new FormData();
        formData.append('name', nameInput.value.trim());
        formData.append('csrfmiddlewaretoken', getCookie('csrftoken'));

        fetch("/items/price-item/create/", {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                modal.hide();
                showToast('Предмет успешно добавлен', 'success');
                // Перезагружаем страницу
                setTimeout(() => {
                    location.reload();
                }, 500);
            } else {
                showToast('Ошибка: ' + (data.error || ''), 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Ошибка при добавлении предмета', 'error');
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Добавить';
            }
        });
    });

    // Очистка формы при закрытии
    modalElement.addEventListener('hidden.bs.modal', function() {
        form.reset();
    });
}

/**
 * Инициализация удаления предмета
 */
function initDeletePriceItem() {
    let deleteItemId = null;
    const deleteModalElement = document.getElementById('deletePriceItemModal');

    if (!deleteModalElement) return;

    const deleteModal = new bootstrap.Modal(deleteModalElement);

    // Обработчик кнопок удаления
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            deleteItemId = this.dataset.itemId;
            deleteModal.show();
        });
    });

    // Подтверждение удаления
    const confirmDeleteBtn = document.getElementById('confirmDeletePriceBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (deleteItemId) {
                fetch(`/items/price-item/${deleteItemId}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showToast('Предмет успешно удалён', 'success');
                        setTimeout(() => location.reload(), 500);
                    } else {
                        showToast('Ошибка при удалении предмета', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Ошибка при удалении предмета', 'error');
                });
            }
        });
    }

    // Сброс при закрытии
    deleteModalElement.addEventListener('hidden.bs.modal', function() {
        deleteItemId = null;
    });
}

/**
 * Инициализация обновления цен
 */
function initRefreshPrices() {
    const refreshBtn = document.getElementById('refreshPricesBtn');
    const loadingModalElement = document.getElementById('loadingModal');
    const loadingText = document.getElementById('loadingText');

    if (!refreshBtn || !loadingModalElement) return;

    const loadingModal = new bootstrap.Modal(loadingModalElement);

    refreshBtn.addEventListener('click', function() {
        // Показываем модальное окно загрузки
        loadingText.textContent = 'Обновление цен...';
        loadingModal.show();

        fetch("/items/price-item/refresh/", {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Закрываем модальное окно
                loadingModal.hide();

                // Формируем сообщение
                const updated = data.updated || 0;
                const total = data.total || 0;
                const failed = data.failed || [];

                let message = `Обновлено: ${updated} из ${total}`;

                if (failed.length > 0) {
                    message += `\nНе удалось загрузить: ${failed.join(', ')}`;
                    showToast(message, 'warning', 5000);
                } else {
                    showToast('Цены успешно обновлены', 'success');
                }

                // Перезагружаем страницу
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                loadingModal.hide();
                showToast('Ошибка: ' + (data.error || ''), 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            loadingModal.hide();
            showToast('Ошибка при обновлении цен', 'error');
        });
    });
}

})();