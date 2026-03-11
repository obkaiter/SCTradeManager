/**
 * Analytics page - profit chart
 */

// Форматирование цены
function formatPrice(value) {
    const num = parseInt(value) || 0;
    return num.toLocaleString('ru-RU') + ' ₽';
}

// Отправка формы фильтра
function submitFilterForm() {
    const form = document.getElementById('analyticsFilterForm');
    if (form) {
        form.submit();
    }
}

// Инициализация кнопок фильтра
function initFilterButtons() {
    // Кнопка "Неделя"
    const weekBtn = document.getElementById('weekBtn');
    if (weekBtn) {
        weekBtn.addEventListener('click', function() {
            const today = new Date();
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);

            const yearFrom = lastWeek.getFullYear();
            const monthFrom = String(lastWeek.getMonth() + 1).padStart(2, '0');
            const dayFrom = String(lastWeek.getDate()).padStart(2, '0');
            const dateFrom = `${yearFrom}-${monthFrom}-${dayFrom}`;

            const yearTo = today.getFullYear();
            const monthTo = String(today.getMonth() + 1).padStart(2, '0');
            const dayTo = String(today.getDate()).padStart(2, '0');
            const dateTo = `${yearTo}-${monthTo}-${dayTo}`;

            document.getElementById('dateFrom').value = dateFrom;
            document.getElementById('dateTo').value = dateTo;
            submitFilterForm();
        });
    }

    // Кнопка "Месяц"
    const monthBtn = document.getElementById('monthBtn');
    if (monthBtn) {
        monthBtn.addEventListener('click', function() {
            const today = new Date();
            const lastMonth = new Date(today);
            lastMonth.setMonth(today.getMonth() - 1);

            const yearFrom = lastMonth.getFullYear();
            const monthFrom = String(lastMonth.getMonth() + 1).padStart(2, '0');
            const dayFrom = String(lastMonth.getDate()).padStart(2, '0');
            const dateFrom = `${yearFrom}-${monthFrom}-${dayFrom}`;

            const yearTo = today.getFullYear();
            const monthTo = String(today.getMonth() + 1).padStart(2, '0');
            const dayTo = String(today.getDate()).padStart(2, '0');
            const dateTo = `${yearTo}-${monthTo}-${dayTo}`;

            document.getElementById('dateFrom').value = dateFrom;
            document.getElementById('dateTo').value = dateTo;
            submitFilterForm();
        });
    }

    // Кнопка "Три месяца"
    const threeMonthsBtn = document.getElementById('threeMonthsBtn');
    if (threeMonthsBtn) {
        threeMonthsBtn.addEventListener('click', function() {
            const today = new Date();
            const threeMonthsAgo = new Date(today);
            threeMonthsAgo.setMonth(today.getMonth() - 3);

            const yearFrom = threeMonthsAgo.getFullYear();
            const monthFrom = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
            const dayFrom = String(threeMonthsAgo.getDate()).padStart(2, '0');
            const dateFrom = `${yearFrom}-${monthFrom}-${dayFrom}`;

            const yearTo = today.getFullYear();
            const monthTo = String(today.getMonth() + 1).padStart(2, '0');
            const dayTo = String(today.getDate()).padStart(2, '0');
            const dateTo = `${yearTo}-${monthTo}-${dayTo}`;

            document.getElementById('dateFrom').value = dateFrom;
            document.getElementById('dateTo').value = dateTo;
            submitFilterForm();
        });
    }

    // Кнопка "Всё"
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            document.getElementById('dateFrom').value = '2020-01-01';
            document.getElementById('dateTo').value = '2099-12-31';
            submitFilterForm();
        });
    }
}

// Инициализация диаграммы
function initProfitChart(labels, data, nameFilter, sortBy) {
    const ctx = document.getElementById('profitChart');
    if (!ctx) return;

    const context = ctx.getContext('2d');
    const chartContainer = document.getElementById('chartContainer');

    // Фиксированная высота контейнера
    if (chartContainer) {
        chartContainer.style.height = '400px';
    }

    new Chart(context, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Чистая прибыль',
                data: data,
                borderColor: 'rgb(40, 167, 69)',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(40, 167, 69)',
                pointBorderColor: 'rgb(40, 167, 69)',
                pointHoverBackgroundColor: 'rgb(40, 167, 69)',
                pointHoverBorderColor: 'rgb(40, 167, 69)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const date = context.label;
                            const [year, month, day] = date.split('-');
                            const formattedDate = `${day}.${month}.${year}`;
                            return `Дата: ${formattedDate} | Чистая прибыль: ${formatPrice(context.parsed.y)}`;
                        }
                    },
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    titleColor: '#f0f0f0',
                    bodyColor: '#f0f0f0',
                    borderColor: '#3e3e42',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    cornerRadius: 6
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const selectedDate = labels[index];

                    // Установка даты в фильтр
                    const dateFromInput = document.getElementById('dateFrom');
                    const dateToInput = document.getElementById('dateTo');

                    if (dateFromInput && dateToInput) {
                        dateFromInput.value = selectedDate;
                        dateToInput.value = selectedDate;

                        // Отправка формы фильтра
                        const form = document.getElementById('analyticsFilterForm');
                        if (form) {
                            form.submit();
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Дата',
                        color: '#f0f0f0',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    },
                    ticks: {
                        color: '#b0b0b0',
                        font: {
                            size: 13
                        }
                    },
                    grid: {
                        color: '#3e3e42',
                        lineWidth: 1
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Чистая прибыль (₽)',
                        color: '#f0f0f0',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    },
                    ticks: {
                        color: '#b0b0b0',
                        font: {
                            size: 13
                        },
                        callback: function(value) {
                            return value.toLocaleString('ru-RU') + ' ₽';
                        }
                    },
                    grid: {
                        color: '#3e3e42',
                        lineWidth: 1
                    }
                }
            },
            animation: {
                duration: 500,
                easing: 'easeOutQuart'
            }
        }
    });
}

// Инициализация при загрузке
(function() {
    function init() {
        initFilterButtons();

        if (!window.chartData) {
            return;
        }

        const labels = window.chartData.labels || [];
        const data = window.chartData.data || [];
        const nameFilter = window.chartData.nameFilter || '';
        const sortBy = window.chartData.sortBy || '-purchase_date';

        if (labels.length > 0 && typeof Chart !== 'undefined') {
            initProfitChart(labels, data, nameFilter, sortBy);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
