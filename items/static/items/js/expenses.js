/**
 * Логика управления расходами.
 * Версия 2.0 - улучшенный UX с toast-уведомлениями
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
                tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted"><i class="bi bi-inbox display-6 d-block mb-2"></i>Нет расходов</td></tr>';
                return;
            }

            // Используем DocumentFragment для эффективной вставки
            const fragment = document.createDocumentFragment();

            data.expenses.forEach(exp => {
                const tr = document.createElement('tr');

                const date = formatDate(exp.date);

                tr.innerHTML = `
                    <td>${date}</td>
                    <td>${formatPrice(exp.amount)}</td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary edit-expense-btn"
                                data-id="${exp.id}"
                                data-date="${exp.date}"
                                data-amount="${exp.amount}"
                                title="Редактировать">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-expense-btn" 
                                data-id="${exp.id}"
                                title="Удалить">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </td>
                `;

                fragment.appendChild(tr);
            });

            tbody.appendChild(fragment);
            initExpenseButtons();
        })
        .catch(error => {
            console.error('Error loading expenses:', error);
            showToast('Ошибка при загрузке расходов', 'error');
        });
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
            const id = this.dataset.id;
            
            if (confirm('Вы уверены, что хотите удалить эту запись о расходах?')) {
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
                        showToast('Расход успешно удалён', 'success');
                        loadExpenses();
                        setTimeout(() => location.reload(), 500);
                    } else {
                        showToast('Ошибка при удалении расхода', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Ошибка при удалении расхода', 'error');
                });
            }
        });
    });
}

/**
 * Инициализация форм расходов
 */
function initExpenseForms() {
    initAddExpenseForm();
    initEditExpenseForm();
}

/**
 * Инициализация формы добавления расхода
 */
function initAddExpenseForm() {
    const addForm = document.getElementById('addExpenseForm');
    if (!addForm) return;

    // Установка текущей даты по умолчанию
    const dateInput = addForm.querySelector('input[name="date"]');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        const amountInput = document.getElementById('addExpenseAmount');
        if (amountInput) {
            formData.set('amount', parsePrice(amountInput.value));
        }

        // Блокировка кнопки отправки
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
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
                showToast('Расход успешно добавлен', 'success');
                this.reset();
                // Возвращаем дату по умолчанию
                const dateInput = this.querySelector('input[name="date"]');
                if (dateInput) {
                    dateInput.value = new Date().toISOString().split('T')[0];
                }
                loadExpenses();
                setTimeout(() => location.reload(), 500);
            } else {
                showToast('Ошибка при добавлении расхода: ' + (data.error || ''), 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Ошибка при добавлении расхода', 'error');
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
            }
        });
    });
}

/**
 * Инициализация формы редактирования расхода
 */
function initEditExpenseForm() {
    const editForm = document.getElementById('editExpenseForm');
    if (!editForm) return;

    editForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        const amountInput = document.getElementById('editExpenseAmount');
        if (amountInput) {
            formData.set('amount', parsePrice(amountInput.value));
        }

        const expenseId = document.getElementById('editExpenseId')?.value;
        if (!expenseId) {
            showToast('Ошибка: не указан ID расхода', 'error');
            return;
        }

        // Блокировка кнопки отправки
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Сохранение...';
        }

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
                showToast('Расход успешно обновлён', 'success');
                const editModal = bootstrap.Modal.getInstance(document.getElementById('editExpenseModal'));
                if (editModal) editModal.hide();
                loadExpenses();
                setTimeout(() => location.reload(), 500);
            } else {
                showToast('Ошибка при обновлении расхода: ' + (data.error || ''), 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Ошибка при обновлении расхода', 'error');
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Сохранить';
            }
        });
    });
}
