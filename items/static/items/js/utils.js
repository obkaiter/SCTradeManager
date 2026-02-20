/**
 * Утилиты для работы с ценами и куки.
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
