/**
 * Утилиты для работы с ценами и куки.
 * Версия 2.0 - оптимизировано для улучшенного UX
 */

/**
 * Форматирование цены с пробелами между разрядами
 * @param {number|string} value - Значение цены
 * @returns {string} Отформатированная цена
 */
function formatPrice(value) {
    if (!value && value !== 0) return '';
    const num = parseInt(value) || 0;
    return num.toLocaleString('ru-RU') + ' ₽';
}

/**
 * Парсинг цены (удаляет пробелы, символ рубля и другие нецифровые символы)
 * @param {string} value - Строка с ценой
 * @returns {string} Чистое числовое значение
 */
function parsePrice(value) {
    if (!value) return '';
    return value.replace(/[^\d-]/g, '');
}

/**
 * Получение CSRF токена из cookie
 * @param {string} name - Имя cookie
 * @returns {string|null} CSRF токен
 */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Инициализация форматирования цены для поля ввода
 * @param {HTMLInputElement} input - Поле ввода
 */
function initPriceFormatting(input) {
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
}

/**
 * Инициализация форматирования цен для нескольких полей
 * @param {string[]} inputIds - Массив ID полей ввода
 */
function initPriceFields(inputIds) {
    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            initPriceFormatting(input);
        }
    });
}

/**
 * Показ toast-уведомления
 * @param {string} message - Сообщение
 * @param {string} type - Тип: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Длительность в мс (по умолчанию 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill',
        warning: 'bi-exclamation-circle-fill'
    };

    const titles = {
        success: 'Успешно',
        error: 'Ошибка',
        info: 'Информация',
        warning: 'Внимание'
    };

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    const iconClass = icons[type] || icons.info;
    const title = titles[type] || titles.info;

    toast.innerHTML = `
        <div class="toast-header">
            <i class="bi ${iconClass} me-2 ${type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : type === 'warning' ? 'text-warning' : 'text-info'}"></i>
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close" aria-label="Закрыть"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    container.appendChild(toast);

    // Запуск анимации появления
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Закрытие по клику на кнопку
    const closeBtn = toast.querySelector('.btn-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideToast(toast);
        });
    }

    // Автоматическое закрытие
    setTimeout(() => {
        hideToast(toast);
    }, duration);
}

/**
 * Скрытие toast-уведомления с анимацией
 * @param {HTMLElement} toast - Элемент уведомления
 */
function hideToast(toast) {
    if (!toast || toast.classList.contains('hiding')) return;
    
    toast.classList.add('hiding');
    toast.classList.remove('show');
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

/**
 * Показывает подтверждение действия
 * @param {string} message - Сообщение подтверждения
 * @returns {Promise<boolean>}
 */
function showConfirm(message) {
    return new Promise((resolve) => {
        const result = confirm(message);
        resolve(result);
    });
}

/**
 * Плавная прокрутка к элементу
 * @param {string|HTMLElement} target - Селектор или элемент
 * @param {number} offset - Отступ в пикселях
 */
function scrollToElement(target, offset = 0) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (element) {
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

/**
 * Дебаунс функция для ограничения частоты вызовов
 * @param {Function} func - Функция
 * @param {number} wait - Задержка в мс
 * @returns {Function}
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Проверка на пустое значение
 * @param {*} value - Значение для проверки
 * @returns {boolean}
 */
function isEmpty(value) {
    return value === null || value === undefined || value === '';
}

/**
 * Форматирование даты в локальном формате
 * @param {string|Date} date - Дата
 * @returns {string}
 */
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
}

/**
 * Получение параметров даты фильтрации из URL
 * @returns {{dateFrom: string, dateTo: string}}
 */
function getDateFilterParams() {
    const params = new URLSearchParams(window.location.search);
    const dateFrom = params.get('date_from') || '';
    const dateTo = params.get('date_to') || '';
    return { dateFrom, dateTo };
}
