/**
 * Логика управления окном "Мякоть".
 */

// Глобальные переменные для хранения цен
let fleshPrices = {
    solovik: 0,
    slastena: 0,
    kubarbuz: 0,
    limonnik: 0
};

document.addEventListener('DOMContentLoaded', function() {
    initFleshModal();
});

/**
 * Инициализация модального окна "Мякоть"
 */
function initFleshModal() {
    const openFleshBtn = document.getElementById('openFleshBtn');
    const fleshModal = document.getElementById('fleshModal');

    if (!openFleshBtn || !fleshModal) return;

    // Загрузка цен при открытии модального окна
    fleshModal.addEventListener('show.bs.modal', function() {
        loadFleshPrices();
        resetFleshQuantities();
        updateFleshTotalSum();
    });

    // Инициализация полей количества
    initFleshQuantityFields();

    // Инициализация кнопки добавления
    initAddFleshButton();

    // Инициализация формы сохранения цен
    initFleshPricesForm();

    // Копирование суммы по клику
    initFleshSumCopy();
}

/**
 * Загрузка цен закупки мякоти
 */
function loadFleshPrices() {
    fetch('/items/flesh/prices/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fleshPrices = data.prices;

                // Заполняем поля цен
                const solovikPriceInput = document.getElementById('fleshSolovikPrice');
                const slastenaPriceInput = document.getElementById('fleshSlastenaPrice');
                const kubarbuzPriceInput = document.getElementById('fleshKubarbuzPrice');
                const limonnikPriceInput = document.getElementById('fleshLimonnikPrice');
                const commentInput = document.getElementById('fleshComment');

                if (solovikPriceInput) solovikPriceInput.value = formatPrice(fleshPrices.solovik);
                if (slastenaPriceInput) slastenaPriceInput.value = formatPrice(fleshPrices.slastena);
                if (kubarbuzPriceInput) kubarbuzPriceInput.value = formatPrice(fleshPrices.kubarbuz);
                if (limonnikPriceInput) limonnikPriceInput.value = formatPrice(fleshPrices.limonnik);
                if (commentInput) commentInput.value = fleshPrices.comment || '';

                // Пересчитываем сумму
                updateFleshTotalSum();
            }
        })
        .catch(error => {
            console.error('Error loading flesh prices:', error);
            showToast('Ошибка при загрузке цен', 'error');
        });
}

/**
 * Сброс полей количества
 */
function resetFleshQuantities() {
    const qtyFields = document.querySelectorAll('.flesh-qty');
    qtyFields.forEach(field => {
        field.value = '';
    });
}

/**
 * Инициализация полей количества (обработчики изменений)
 */
function initFleshQuantityFields() {
    const qtyFields = document.querySelectorAll('.flesh-qty');
    qtyFields.forEach(field => {
        field.addEventListener('input', updateFleshTotalSum);
    });
}

/**
 * Обновление суммы
 */
function updateFleshTotalSum() {
    const solovikQty = parseInt(document.getElementById('fleshSolovikQty')?.value || 0);
    const slastenaQty = parseInt(document.getElementById('fleshSlastenaQty')?.value || 0);
    const kubarbuzQty = parseInt(document.getElementById('fleshKubarbuzQty')?.value || 0);
    const limonnikQty = parseInt(document.getElementById('fleshLimonnikQty')?.value || 0);

    const totalSum = (
        solovikQty * fleshPrices.solovik +
        slastenaQty * fleshPrices.slastena +
        kubarbuzQty * fleshPrices.kubarbuz +
        limonnikQty * fleshPrices.limonnik
    );

    const totalSumElement = document.getElementById('fleshTotalSum');
    if (totalSumElement) {
        totalSumElement.textContent = formatPrice(totalSum);
    }
}

/**
 * Инициализация формы сохранения цен
 */
function initFleshPricesForm() {
    const fleshPricesForm = document.getElementById('fleshPricesForm');
    if (!fleshPricesForm) return;

    fleshPricesForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);

        // Получаем значения и парсим цены
        const solovikPriceInput = document.getElementById('fleshSolovikPrice');
        const slastenaPriceInput = document.getElementById('fleshSlastenaPrice');
        const kubarbuzPriceInput = document.getElementById('fleshKubarbuzPrice');
        const limonnikPriceInput = document.getElementById('fleshLimonnikPrice');
        const commentInput = document.getElementById('fleshComment');

        const postData = new URLSearchParams();
        postData.append('solovik', parsePrice(solovikPriceInput?.value || 0));
        postData.append('slastena', parsePrice(slastenaPriceInput?.value || 0));
        postData.append('kubarbuz', parsePrice(kubarbuzPriceInput?.value || 0));
        postData.append('limonnik', parsePrice(limonnikPriceInput?.value || 0));
        postData.append('comment', commentInput?.value || '');

        fetch('/items/flesh/prices/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: postData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fleshPrices = data.prices;
                updateFleshTotalSum();

                // Закрываем модальное окно цен
                const pricesModal = bootstrap.Modal.getInstance(document.getElementById('fleshPricesModal'));
                if (pricesModal) pricesModal.hide();

                showToast('Цены закупки сохранены', 'success');
            } else {
                showToast('Ошибка при сохранении цен: ' + (data.error || ''), 'error');
            }
        })
        .catch(error => {
            console.error('Error saving flesh prices:', error);
            showToast('Ошибка при сохранении цен', 'error');
        });
    });
}

/**
 * Инициализация кнопки добавления предметов мякоти
 */
function initAddFleshButton() {
    const confirmAddFleshBtn = document.getElementById('confirmAddFleshBtn');
    if (!confirmAddFleshBtn) return;

    confirmAddFleshBtn.addEventListener('click', function() {
        addFleshItems();
    });
}

/**
 * Добавление предметов мякоти
 */
function addFleshItems() {
    const solovikQty = parseInt(document.getElementById('fleshSolovikQty')?.value || 0);
    const slastenaQty = parseInt(document.getElementById('fleshSlastenaQty')?.value || 0);
    const kubarbuzQty = parseInt(document.getElementById('fleshKubarbuzQty')?.value || 0);
    const limonnikQty = parseInt(document.getElementById('fleshLimonnikQty')?.value || 0);

    // Проверяем, есть ли хоть одно значение
    if (solovikQty === 0 && slastenaQty === 0 && kubarbuzQty === 0 && limonnikQty === 0) {
        showToast('Введите количество хотя бы одного вида мякоти', 'warning');
        return;
    }

    const formData = new URLSearchParams();
    formData.append('solovik_qty', solovikQty);
    formData.append('slastena_qty', slastenaQty);
    formData.append('kubarbuz_qty', kubarbuzQty);
    formData.append('limonnik_qty', limonnikQty);

    // Блокируем кнопку
    const confirmAddFleshBtn = document.getElementById('confirmAddFleshBtn');
    if (confirmAddFleshBtn) {
        confirmAddFleshBtn.disabled = true;
        confirmAddFleshBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Добавление...';
    }

    fetch('/items/flesh/add/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const fleshModal = bootstrap.Modal.getInstance(document.getElementById('fleshModal'));
            if (fleshModal) fleshModal.hide();

            // Перезагружаем страницу с сохранением параметров фильтра
            const urlParams = new URLSearchParams(window.location.search);
            showToast('Предметы мякоти добавлены', 'success');
            setTimeout(() => {
                window.location.href = '?' + urlParams.toString();
            }, 500);
        } else {
            showToast('Ошибка при добавлении: ' + (data.error || ''), 'error');
        }
    })
    .catch(error => {
        console.error('Error adding flesh items:', error);
        showToast('Ошибка при добавлении', 'error');
    })
    .finally(() => {
        if (confirmAddFleshBtn) {
            confirmAddFleshBtn.disabled = false;
            confirmAddFleshBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Добавить';
        }
    });
}

/**
 * Инициализация копирования суммы по клику
 */
function initFleshSumCopy() {
    const fleshTotalSum = document.getElementById('fleshTotalSum');
    if (!fleshTotalSum) return;

    fleshTotalSum.addEventListener('click', function() {
        const sumText = this.textContent.trim();
        // Извлекаем числовое значение (убираем "₽" и пробелы)
        const numericValue = sumText.replace(/[^\d]/g, '');

        if (!numericValue) return;

        navigator.clipboard.writeText(numericValue).then(() => {
            showToast(`Сумма ${sumText} скопирована в буфер обмена`, 'success', 2000);
        }).catch(() => {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = numericValue;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast(`Сумма ${sumText} скопирована в буфер обмена`, 'success', 2000);
            } catch (err) {
                showToast('Не удалось скопировать сумму', 'error');
            }
            document.body.removeChild(textArea);
        });
    });
}
