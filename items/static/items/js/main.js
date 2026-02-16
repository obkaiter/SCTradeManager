/**
 * Основная логика страницы списка предметов.
 */
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация редактируемых ячеек
    const editableCells = document.querySelectorAll('.editable-cell');
    if (editableCells.length > 0) {
        initEditableCells(editableCells);
    }

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

    // Кнопка "Отобразить всё"
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            const today = new Date().toISOString().split('T')[0];
            const hideSold = hideSoldState?.value || 'false';
            window.location.href = '?date_from=2020-01-01&date_to=' + today + '&hide_sold=' + hideSold;
        });
    }

    // Кнопка "Сегодня"
    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', function() {
            const today = new Date().toISOString().split('T')[0];
            const hideSold = hideSoldState?.value || 'false';
            window.location.href = '?date_from=' + today + '&date_to=' + today + '&hide_sold=' + hideSold;
        });
    }

    // Удаление предмета с модальным окном
    let deleteItemId = null;
    const deleteModalElement = document.getElementById('deleteModal');
    
    if (deleteModalElement) {
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

    // Установка сегодняшней даты в форму добавления предмета
    const addItemPurchaseDate = document.getElementById('addItemPurchaseDate');
    if (addItemPurchaseDate) {
        const today = new Date().toISOString().split('T')[0];
        const lastPurchaseDate = localStorage.getItem('lastPurchaseDate') || today;
        addItemPurchaseDate.value = lastPurchaseDate;

        addItemPurchaseDate.addEventListener('change', function() {
            localStorage.setItem('lastPurchaseDate', this.value);
        });
    }

    const saleDateInput = document.querySelector('#addItemModal [name="sale_date"]');
    if (saleDateInput) {
        const lastSaleDate = localStorage.getItem('lastSaleDate') || '';
        if (lastSaleDate) {
            saleDateInput.value = lastSaleDate;
        }

        saleDateInput.addEventListener('change', function() {
            localStorage.setItem('lastSaleDate', this.value);
        });
    }

    // Форматирование цен в формах
    const expenseAmountInputs = ['addExpenseAmount', 'editExpenseAmount'];
    expenseAmountInputs.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        input.addEventListener('blur', function() {
            const rawValue = parsePrice(this.value);
            if (rawValue) {
                this.value = formatPrice(rawValue);
            }
        });

        input.addEventListener('focus', function() {
            const rawValue = parsePrice(this.value);
            this.value = rawValue;
            this.select();
        });
    });

    // Форматирование цен в форме добавления предмета
    const itemPriceInputs = ['addItemPurchasePrice', 'addItemSalePrice'];
    itemPriceInputs.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        input.addEventListener('blur', function() {
            const rawValue = parsePrice(this.value);
            if (rawValue) {
                this.value = formatPrice(rawValue);
            }
        });

        input.addEventListener('focus', function() {
            const rawValue = parsePrice(this.value);
            this.value = rawValue;
            this.select();
        });
    });

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
    const addItemForm = document.getElementById('addItemForm');
    if (addItemForm) {
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
                    location.reload();
                }
            })
            .catch(error => console.error('Error:', error));
        });
    }
});
