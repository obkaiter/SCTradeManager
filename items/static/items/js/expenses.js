/**
 * Логика управления расходами.
 */

/**
 * Загрузка списка расходов
 */
function loadExpenses() {
    fetch("/items/expenses/")
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('expenseListBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';

            if (!data.expenses || data.expenses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Нет расходов</td></tr>';
                return;
            }

            data.expenses.forEach(exp => {
                const date = new Date(exp.date).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit'
                });
                const row = `
                    <tr>
                        <td>${date}</td>
                        <td>${formatPrice(exp.amount)}</td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-expense-btn"
                                data-id="${exp.id}"
                                data-date="${exp.date}"
                                data-amount="${exp.amount}">
                                ✎
                            </button>
                            <button class="btn btn-sm btn-danger delete-expense-btn" data-id="${exp.id}">
                                &times;
                            </button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });

            initExpenseButtons();
        })
        .catch(error => console.error('Error loading expenses:', error));
}

/**
 * Инициализация кнопок расходов
 */
function initExpenseButtons() {
    // Редактирование
    document.querySelectorAll('.edit-expense-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const date = this.dataset.date;
            const amount = this.dataset.amount;

            const editId = document.getElementById('editExpenseId');
            const editDate = document.getElementById('editExpenseDate');
            const editAmount = document.getElementById('editExpenseAmount');
            
            if (editId) editId.value = id;
            if (editDate) editDate.value = date;
            if (editAmount) editAmount.value = parsePrice(amount);

            const editModal = new bootstrap.Modal(document.getElementById('editExpenseModal'));
            editModal.show();
        });
    });

    // Удаление
    document.querySelectorAll('.delete-expense-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('Удалить эту запись о расходах?')) {
                const id = this.dataset.id;
                fetch(`/items/expenses/${id}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        loadExpenses();
                        location.reload();
                    }
                })
                .catch(error => console.error('Error:', error));
            }
        });
    });
}

/**
 * Инициализация формы добавления расходов
 */
function initExpenseForms() {
    const addForm = document.getElementById('addExpenseForm');
    if (addForm) {
        addForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);

            const amountInput = document.getElementById('addExpenseAmount');
            if (amountInput) {
                formData.set('amount', parsePrice(amountInput.value));
            }

            fetch("/items/expenses/create/", {
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
                    this.reset();
                    loadExpenses();
                    location.reload();
                }
            })
            .catch(error => console.error('Error:', error));
        });
    }

    const editForm = document.getElementById('editExpenseForm');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            
            const amountInput = document.getElementById('editExpenseAmount');
            if (amountInput) {
                formData.set('amount', parsePrice(amountInput.value));
            }

            const expenseId = document.getElementById('editExpenseId')?.value;
            if (!expenseId) return;

            fetch(`/items/expenses/${expenseId}/update/`, {
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
                    const editModal = bootstrap.Modal.getInstance(document.getElementById('editExpenseModal'));
                    if (editModal) editModal.hide();
                    loadExpenses();
                    location.reload();
                }
            })
            .catch(error => console.error('Error:', error));
        });
    }
}
