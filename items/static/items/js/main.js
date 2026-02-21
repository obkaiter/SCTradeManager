/**
 * Основная логика страницы списка предметов.
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

        if (hideSoldValue === 'true') {
            toggleSoldBtn.innerHTML = '<i class="bi bi-eye"></i> Показать проданные';
            toggleSoldBtn.classList.remove('btn-secondary');
            toggleSoldBtn.classList.add('btn-success');
        }

        toggleSoldBtn.addEventListener('click', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const currentHideSold = urlParams.get('hide_sold') || 'false';
            const newHideSold = currentHideSold === 'true' ? 'false' : 'true';

            urlParams.set('hide_sold', newHideSold);

            if (newHideSold === 'true') {
                toggleSoldBtn.innerHTML = '<i class="bi bi-eye"></i> Показать проданные';
                toggleSoldBtn.classList.remove('btn-secondary');
                toggleSoldBtn.classList.add('btn-success');
            } else {
                toggleSoldBtn.innerHTML = '<i class="bi bi-eye-slash"></i> Скрыть проданные';
                toggleSoldBtn.classList.remove('btn-success');
                toggleSoldBtn.classList.add('btn-secondary');
            }

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
});

/**
 * Настройка кнопок фильтра по дате
 */
function setupDateFilterButtons(hideSoldState) {
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            const hideSold = hideSoldState?.value || 'false';
            const nameFilter = document.getElementById('filterNameInput')?.value || '';
            // Показываем все предметы с 2020 года до 2099 года
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
                        location.reload();
                    }
                })
                .catch(error => console.error('Error:', error));
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
                this.reset();

                const dateInput = this.querySelector('[name="purchase_date"]');
                if (dateInput) {
                    dateInput.value = new Date().toISOString().split('T')[0];
                }
                // Перезагружаем страницу с сохранением текущих параметров фильтра
                const urlParams = new URLSearchParams(window.location.search);
                window.location.href = '?' + urlParams.toString();
            }
        })
        .catch(error => console.error('Error:', error));
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
