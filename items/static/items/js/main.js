/**
 * Основной скрипт страницы списка предметов.
 * Версия 2.0 - улучшенный UX с toast-уведомлениями
 */
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация редактируемых ячеек
    const editableCells = document.querySelectorAll('.editable-cell');
    if (editableCells.length > 0) {
        initEditableCells(editableCells);
    }

    // Инициализация форматирования цен во всех формах
    initPriceFields(['addExpenseAmount', 'editExpenseAmount']);
    initPriceFields(['addItemPurchasePrice', 'addItemSalePrice']);
    initPriceFields(['addPriceAmount']);

    // Сортировка по клику на заголовок
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const field = this.dataset.sort;
            const currentSort = this.closest('table').dataset.currentSort || '';
            let newSort;

            if (currentSort === field) {
                newSort = '-' + field;
            } else if (currentSort === '-' + field) {
                newSort = field;
            } else {
                newSort = field;
            }

            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('sort', newSort);
            window.location.href = '?' + urlParams.toString();
        });
    });

    // Фильтр по дате
    const dateFilterForm = document.getElementById('dateFilterModalForm');
    if (dateFilterForm) {
        dateFilterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const hideSoldState = document.getElementById('hideSoldState')?.value || 'false';
            formData.append('hide_sold', hideSoldState);

            const queryString = new URLSearchParams(formData).toString();
            window.location.href = '?' + queryString;
        });
    }

    // Кнопка "Скрыть/Показать проданные"
    const toggleSoldBtn = document.getElementById('toggleSoldBtn');
    const hideSoldState = document.getElementById('hideSoldState');

    if (toggleSoldBtn && hideSoldState) {
        const hideSoldValue = hideSoldState.value;

        updateToggleButton(toggleSoldBtn, hideSoldValue === 'true');

        toggleSoldBtn.addEventListener('click', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const currentHideSold = urlParams.get('hide_sold') || 'false';
            const newHideSold = currentHideSold === 'true' ? 'false' : 'true';

            urlParams.set('hide_sold', newHideSold);

            updateToggleButton(toggleSoldBtn, newHideSold === 'true');

            window.location.href = '?' + urlParams.toString();
        });
    }

    // Кнопки фильтра по дате
    setupDateFilterButtons(hideSoldState);

    // Инициализация модального окна фильтра
    initDateFilterModal();

    // Удаление предмета с модальным окном
    initDeleteItem();

    // Автозаполнение даты в форме добавления предмета
    initAddItemForm();

    // Загрузка расходов при открытии модального окна
    const openExpenseBtn = document.getElementById('openExpenseBtn');
    if (openExpenseBtn) {
        openExpenseBtn.addEventListener('click', function() {
            setTimeout(loadExpenses, 100);
        });
    }

    // Инициализация форм расходов
    initExpenseForms();

    // Добавление предмета
    initAddItemSubmit();

    // Обновление кнопки фильтра при загрузке
    updateFilterButtonLabels();
});

/**
 * Обновление кнопки скрытия проданных
 */
function updateToggleButton(btn, isHidden) {
    if (isHidden) {
        btn.innerHTML = '<i class="bi bi-eye"></i> <span class="d-none d-sm-inline">Показать проданные</span>';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-success');
    } else {
        btn.innerHTML = '<i class="bi bi-eye-slash"></i> <span class="d-none d-sm-inline">Скрыть проданные</span>';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-secondary');
    }
}

/**
 * Обновление меток кнопок фильтра
 */
function updateFilterButtonLabels() {
    const urlParams = new URLSearchParams(window.location.search);
    const dateFrom = urlParams.get('date_from');
    const dateTo = urlParams.get('date_to');
    
    if (dateFrom && dateTo) {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        // Проверка на "сегодня"
        if (from.getTime() === today.getTime() && to.getTime() === today.getTime()) {
            highlightActiveFilterButton('todayBtn');
        }
        // Проверка на "неделя"
        else if (from.getTime() === weekAgo.getTime() && to.getTime() === today.getTime()) {
            highlightActiveFilterButton('weekBtn');
        }
        // Проверка на "всё"
        else if (from.getFullYear() <= 2020 && to.getFullYear() >= 2099) {
            highlightActiveFilterButton('showAllBtn');
        }
    }
}

/**
 * Подсветка активной кнопки фильтра
 */
function highlightActiveFilterButton(activeId) {
    ['todayBtn', 'weekBtn', 'showAllBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            if (id === activeId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

/**
 * Настройка кнопок фильтра по дате
 */
function setupDateFilterButtons(hideSoldState) {
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            const hideSold = hideSoldState?.value || 'false';
            const nameFilter = document.getElementById('filterNameInput')?.value || '';
            let url = '?date_from=2020-01-01&date_to=2099-12-31&hide_sold=' + hideSold;
            if (nameFilter) {
                url += '&name=' + encodeURIComponent(nameFilter);
            }
            window.location.href = url;
        });
    }

    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', function() {
            const today = new Date().toISOString().split('T')[0];
            const hideSold = hideSoldState?.value || 'false';
            const nameFilter = document.getElementById('filterNameInput')?.value || '';
            let url = '?date_from=' + today + '&date_to=' + today + '&hide_sold=' + hideSold;
            if (nameFilter) {
                url += '&name=' + encodeURIComponent(nameFilter);
            }
            window.location.href = url;
        });
    }

    const weekBtn = document.getElementById('weekBtn');
    if (weekBtn) {
        weekBtn.addEventListener('click', function() {
            const today = new Date();
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);

            const dateFrom = lastWeek.toISOString().split('T')[0];
            const dateTo = today.toISOString().split('T')[0];

            const hideSold = hideSoldState?.value || 'false';
            const nameFilter = document.getElementById('filterNameInput')?.value || '';
            let url = '?date_from=' + dateFrom + '&date_to=' + dateTo + '&hide_sold=' + hideSold;
            if (nameFilter) {
                url += '&name=' + encodeURIComponent(nameFilter);
            }
            window.location.href = url;
        });
    }
}

/**
 * Инициализация удаления предмета
 */
function initDeleteItem() {
    let deleteItemId = null;
    const deleteModalElement = document.getElementById('deleteModal');

    if (!deleteModalElement) return;

    const deleteModal = new bootstrap.Modal(deleteModalElement);

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            deleteItemId = this.dataset.itemId;
            deleteModal.show();
        });
    });

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (deleteItemId) {
                fetch(`/items/${deleteItemId}/delete/`, {
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

    deleteModalElement.addEventListener('hidden.bs.modal', function() {
        deleteItemId = null;
    });
}

/**
 * Инициализация формы добавления предмета
 */
function initAddItemForm() {
    const addItemModal = document.getElementById('addItemModal');
    if (!addItemModal) return;

    addItemModal.addEventListener('show.bs.modal', function() {
        const today = new Date().toISOString().split('T')[0];
        const purchaseDateInput = document.getElementById('addItemPurchaseDate');
        if (purchaseDateInput) {
            purchaseDateInput.value = today;
        }
        // Очищаем форму
        const addItemForm = document.getElementById('addItemForm');
        if (addItemForm) {
            addItemForm.reset();
            purchaseDateInput.value = today;
        }
    });
    
    // Закрытие модального окна и очистка при скрытии
    addItemModal.addEventListener('hidden.bs.modal', function() {
        const addItemForm = document.getElementById('addItemForm');
        if (addItemForm) {
            addItemForm.reset();
            const today = new Date().toISOString().split('T')[0];
            const purchaseDateInput = document.getElementById('addItemPurchaseDate');
            if (purchaseDateInput) {
                purchaseDateInput.value = today;
            }
        }
    });
}

/**
 * Инициализация отправки формы добавления предмета
 */
function initAddItemSubmit() {
    const addItemForm = document.getElementById('addItemForm');
    if (!addItemForm) return;

    addItemForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        const purchasePriceInput = document.getElementById('addItemPurchasePrice');
        const salePriceInput = document.getElementById('addItemSalePrice');

        if (purchasePriceInput) {
            formData.set('purchase_price', parsePrice(purchasePriceInput.value));
        }
        if (salePriceInput) {
            formData.set('sale_price', parsePrice(salePriceInput.value));
        }

        // Блокировка кнопки отправки
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Добавление...';
        }

        fetch("/items/add/", {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('addItemModal'));
                if (modal) modal.hide();
                
                showToast('Предмет успешно добавлен', 'success');
                
                // Перезагружаем страницу с сохранением текущих параметров фильтра
                setTimeout(() => {
                    const urlParams = new URLSearchParams(window.location.search);
                    window.location.href = '?' + urlParams.toString();
                }, 500);
            } else {
                showToast('Ошибка при добавлении предмета: ' + (data.error || 'Неизвестная ошибка'), 'error');
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
}

/**
 * Инициализация модального окна фильтра
 */
function initDateFilterModal() {
    const dateFilterModal = document.getElementById('dateFilterModal');
    const filterNameInput = document.getElementById('filterNameInput');

    if (!dateFilterModal || !filterNameInput) return;

    // Отображение текущего значения при открытии модального окна
    dateFilterModal.addEventListener('show.bs.modal', function() {
        const urlParams = new URLSearchParams(window.location.search);
        filterNameInput.value = urlParams.get('name') || '';
    });

    // Сброс поля при закрытии модального окна
    dateFilterModal.addEventListener('hidden.bs.modal', function() {
        filterNameInput.value = '';
    });
}
