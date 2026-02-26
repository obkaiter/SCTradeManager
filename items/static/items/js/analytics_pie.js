/**
 * Analytics Pie Chart - круговая диаграмма прибыли по предметам
 */

// Форматирование цены
function formatPrice(value) {
    const num = parseInt(value) || 0;
    return num.toLocaleString('ru-RU') + ' ₽';
}

// Инициализация круговой диаграммы
function initPieChart(labels, data, counts, avgProfits) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;

    const context = ctx.getContext('2d');

    // Цвета для секторов диаграммы
    const backgroundColors = [
        'rgba(77, 166, 255, 0.8)',
        'rgba(40, 167, 69, 0.8)',
        'rgba(255, 193, 7, 0.8)',
        'rgba(220, 53, 69, 0.8)',
        'rgba(108, 117, 125, 0.8)',
        'rgba(0, 200, 83, 0.8)',
        'rgba(255, 152, 0, 0.8)',
        'rgba(156, 39, 176, 0.8)',
        'rgba(33, 150, 243, 0.8)',
        'rgba(244, 67, 54, 0.8)',
        'rgba(76, 175, 80, 0.8)',
        'rgba(255, 87, 34, 0.8)',
        'rgba(121, 85, 72, 0.8)',
        'rgba(0, 188, 212, 0.8)',
        'rgba(233, 30, 99, 0.8)',
        'rgba(63, 81, 181, 0.8)',
        'rgba(3, 169, 244, 0.8)',
        'rgba(139, 195, 74, 0.8)',
        'rgba(255, 167, 38, 0.8)',
        'rgba(96, 125, 139, 0.8)',
    ];

    // Генерируем дополнительные цвета если нужно
    while (backgroundColors.length < labels.length) {
        const randomColor = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.8)`;
        backgroundColors.push(randomColor);
    }

    new Chart(context, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(30, 30, 30, 1)',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#f0f0f0',
                        font: {
                            size: 13
                        },
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const count = counts[index] || 0;
                            const avgProfit = avgProfits[index] || 0;
                            
                            return [
                                `Предмет: ${label}`,
                                `Общая прибыль: ${formatPrice(value)}`,
                                `Количество: ${count}`,
                                `Средняя прибыль: ${formatPrice(avgProfit)}`
                            ];
                        }
                    },
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    titleColor: '#f0f0f0',
                    bodyColor: '#f0f0f0',
                    borderColor: '#3e3e42',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 6,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
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

// Инициализация сортировки таблицы
function initTableSorting() {
    const table = document.querySelector('.table-excel');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    let currentSortField = 'total_profit';
    let currentSortDir = 'desc';

    table.querySelectorAll('.sortable').forEach(th => {
        // Удаляем все существующие обработчики клонированием элемента
        const newTh = th.cloneNode(true);
        th.parentNode.replaceChild(newTh, th);
        
        newTh.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const field = this.dataset.sort;
            
            // Определяем направление сортировки
            if (currentSortField === field) {
                currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
            } else {
                currentSortField = field;
                currentSortDir = 'desc';
            }

            // Сортировка строк на стороне клиента
            rows.sort((a, b) => {
                let aVal, bVal;
                const cells = a.querySelectorAll('td');
                const bCells = b.querySelectorAll('td');

                if (field === 'name') {
                    aVal = cells[1].textContent.trim();
                    bVal = bCells[1].textContent.trim();
                    return currentSortDir === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
                } else if (field === 'count') {
                    aVal = parseInt(cells[2].textContent.trim()) || 0;
                    bVal = parseInt(bCells[2].textContent.trim()) || 0;
                    return currentSortDir === 'desc' ? bVal - aVal : aVal - bVal;
                } else if (field === 'total_profit' || field === 'avg_profit') {
                    const cellIndex = field === 'total_profit' ? 3 : 4;
                    aVal = parseInt(cells[cellIndex].textContent.replace(/\D/g, '')) || 0;
                    bVal = parseInt(bCells[cellIndex].textContent.replace(/\D/g, '')) || 0;
                    return currentSortDir === 'desc' ? bVal - aVal : aVal - bVal;
                }
                return 0;
            });

            // Перерисовка таблицы
            rows.forEach((row, index) => {
                tbody.appendChild(row);
                // Обновляем номер строки
                const firstCell = row.querySelector('td:first-child');
                if (firstCell) {
                    firstCell.textContent = index + 1;
                }
            });

            // Обновление иконок сортировки
            table.querySelectorAll('.sort-icon').forEach(icon => {
                icon.innerHTML = '<i class="bi bi-arrow-down-up"></i>';
            });
            const activeIcon = newTh.querySelector('.sort-icon');
            if (activeIcon) {
                if (currentSortDir === 'desc') {
                    activeIcon.innerHTML = '<i class="bi bi-arrow-down"></i>';
                } else {
                    activeIcon.innerHTML = '<i class="bi bi-arrow-up"></i>';
                }
            }
        });
    });
}

// Инициализация при загрузке
(function() {
    function init() {
        // Проверяем наличие данных для круговой диаграммы
        if (!window.pieChartData) {
            return;
        }

        const labels = window.pieChartData.labels || [];
        const data = window.pieChartData.data || [];
        const counts = window.pieChartData.counts || [];
        const avgProfits = window.pieChartData.avgProfits || [];

        if (labels.length > 0 && typeof Chart !== 'undefined') {
            initPieChart(labels, data, counts, avgProfits);
        }

        initTableSorting();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
