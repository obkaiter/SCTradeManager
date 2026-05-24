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
    initPriceFields(['fleshSolovikPrice', 'fleshSlastenaPrice', 'fleshKubarbuzPrice', 'fleshLimonnikPrice']);
    // Поле количества не требует форматирования цены

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

    // Обработчик кнопки "Аналитика" - передача текущих параметров фильтра
    const analyticsLink = document.getElementById('analyticsLink');
    if (analyticsLink) {
        analyticsLink.addEventListener('click', function(e) {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            // Сохраняем все текущие параметры
            const dateFrom = urlParams.get('date_from') || '';
            const dateTo = urlParams.get('date_to') || '';
            const hideSold = urlParams.get('hide_sold') || 'false';
            const name = urlParams.get('name') || '';
            const sort = urlParams.get('sort') || '-purchase_date';
            
            // Формируем URL с параметрами
            const params = new URLSearchParams({
                date_from: dateFrom,
                date_to: dateTo,
                hide_sold: hideSold,
                name: name,
                sort: sort
            });
            window.location.href = '/items/analytics/?' + params.toString();
        });
    }
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

        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Проверка на "сегодня"
        if (from.getTime() === today.getTime() && to.getTime() === today.getTime()) {
            highlightActiveFilterButton('todayBtn');
        }
        // Проверка на "3 дня"
        else if (from.getTime() === threeDaysAgo.getTime() && to.getTime() === today.getTime()) {
            highlightActiveFilterButton('threeDaysBtn');
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
    ['todayBtn', 'threeDaysBtn', 'showAllBtn'].forEach(id => {
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
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;
            const hideSold = hideSoldState?.value || 'false';
            const nameFilter = document.getElementById('filterNameInput')?.value || '';
            let url = '?date_from=' + today + '&date_to=' + today + '&hide_sold=' + hideSold;
            if (nameFilter) {
                url += '&name=' + encodeURIComponent(nameFilter);
            }
            window.location.href = url;
        });
    }

    const threeDaysBtn = document.getElementById('threeDaysBtn');
    if (threeDaysBtn) {
        threeDaysBtn.addEventListener('click', function() {
            const today = new Date();
            const threeDaysAgo = new Date(today);
            threeDaysAgo.setDate(today.getDate() - 3);

            const yearFrom = threeDaysAgo.getFullYear();
            const monthFrom = String(threeDaysAgo.getMonth() + 1).padStart(2, '0');
            const dayFrom = String(threeDaysAgo.getDate()).padStart(2, '0');
            const dateFrom = `${yearFrom}-${monthFrom}-${dayFrom}`;

            const yearTo = today.getFullYear();
            const monthTo = String(today.getMonth() + 1).padStart(2, '0');
            const dayTo = String(today.getDate()).padStart(2, '0');
            const dateTo = `${yearTo}-${monthTo}-${dayTo}`;

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

    // Функция получения локальной даты
    function getLocalDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    addItemModal.addEventListener('show.bs.modal', function() {
        const today = getLocalDate();
        const purchaseDateInput = document.getElementById('addItemPurchaseDate');
        if (purchaseDateInput) {
            purchaseDateInput.value = today;
        }
        // Устанавливаем значение по умолчанию для дублирования
        const duplicateInput = document.getElementById('addItemDuplicate');
        if (duplicateInput) {
            duplicateInput.value = '0';
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
            const today = getLocalDate();
            const purchaseDateInput = document.getElementById('addItemPurchaseDate');
            if (purchaseDateInput) {
                purchaseDateInput.value = today;
            }
            // Сбрасываем значение дублирования
            const duplicateInput = document.getElementById('addItemDuplicate');
            if (duplicateInput) {
                duplicateInput.value = '0';
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

        // Убедимся, что значение дублирования передаётся
        const duplicateInput = document.getElementById('addItemDuplicate');
        if (duplicateInput) {
            formData.set('duplicate', duplicateInput.value);
            console.log('Duplicate value sent:', duplicateInput.value);
        } else {
            console.log('Duplicate input not found!');
        }

        // Логируем все данные формы
        for (var pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }

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
                
                // Показываем уведомление с учётом количества созданных предметов
                const itemsCount = data.items_count || 1;
                if (itemsCount > 1) {
                    showToast(`Предмет успешно добавлен (создано ${itemsCount} шт.)`, 'success');
                } else {
                    showToast('Предмет успешно добавлен', 'success');
                }
                
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
