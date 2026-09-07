/**
 * График закупочной и продажной цены выбранного предмета и сортировка лотов.
 */

function formatItemPrice(value) {
    return (Number(value) || 0).toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }) + ' ₽';
}

function initItemPriceAnalytics(items) {
    const canvas = document.getElementById('itemPriceChart');
    const title = document.getElementById('itemPriceChartTitle');
    const table = document.querySelector('.table-excel');
    if (!canvas || !title || !table || items.length === 0 || typeof Chart === 'undefined') return;

    const rows = Array.from(table.querySelectorAll('tbody .analytics-item-row'));
    let selectedItemName = rows[0].dataset.itemName;
    let chart;

    function recordsForItem(itemName) {
        return items
            .filter(item => item.name === itemName)
            .sort((a, b) => a.saleDate.localeCompare(b.saleDate) || a.id - b.id);
    }

    function showItem(itemName) {
        const records = recordsForItem(itemName);
        if (records.length === 0) return;

        selectedItemName = itemName;
        title.textContent = records[0].name;
        rows.forEach(row => {
            const isSelected = row.dataset.itemName === itemName;
            row.classList.toggle('is-selected', isSelected);
            row.setAttribute('aria-pressed', String(isSelected));
        });

        const chartData = {
            labels: records.map(item => item.saleDate),
            datasets: [
                {
                    label: 'Закупочная цена за 1 предмет',
                    data: records.map(item => item.purchaseUnitPrice),
                    borderColor: 'rgb(255, 193, 7)',
                    backgroundColor: 'rgba(255, 193, 7, 0.15)',
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
                {
                    label: 'Продажная цена за 1 предмет',
                    data: records.map(item => item.saleUnitPrice),
                    borderColor: 'rgb(40, 167, 69)',
                    backgroundColor: 'rgba(40, 167, 69, 0.15)',
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                }
            ]
        };

        if (chart) {
            chart.data = chartData;
            chart.options.plugins.tooltip.callbacks.title = context => {
                const record = records[context[0].dataIndex];
                return `${record.saleDate} · лот #${record.id} · ${record.quantity} шт.`;
            };
            chart.update();
            return;
        }

        chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#f0f0f0' }
                    },
                    tooltip: {
                        callbacks: {
                            title: context => {
                                const record = records[context[0].dataIndex];
                                return `${record.saleDate} · лот #${record.id} · ${record.quantity} шт.`;
                            },
                            label: context => `${context.dataset.label}: ${formatItemPrice(context.parsed.y)}`
                        },
                        backgroundColor: 'rgba(30, 30, 30, 0.95)',
                        titleColor: '#f0f0f0',
                        bodyColor: '#f0f0f0',
                        borderColor: '#3e3e42',
                        borderWidth: 1,
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Дата продажи', color: '#f0f0f0' },
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#3e3e42' }
                    },
                    y: {
                        title: { display: true, text: 'Цена за 1 предмет (₽)', color: '#f0f0f0' },
                        ticks: {
                            color: '#b0b0b0',
                            callback: value => formatItemPrice(value)
                        },
                        grid: { color: '#3e3e42' }
                    }
                }
            }
        });
    }

    rows.forEach(row => {
        const selectRow = () => showItem(row.dataset.itemName);
        row.addEventListener('click', selectRow);
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectRow();
            }
        });
    });

    showItem(selectedItemName);
}

function initAnalyticsTableSorting() {
    const table = document.querySelector('.table-excel');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('.analytics-item-row'));
    let currentSortField = '';
    let currentSortDir = 'desc';
    const fieldColumns = {
        name: 1,
        quantity: 2,
        purchase_price: 3,
        sale_price: 4,
        profit: 5,
    };

    table.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const field = this.dataset.sort;
            const column = fieldColumns[field];
            if (column === undefined) return;

            if (currentSortField === field) {
                currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
            } else {
                currentSortField = field;
                currentSortDir = field === 'name' ? 'asc' : 'desc';
            }

            rows.sort((rowA, rowB) => {
                const valueA = rowA.cells[column].dataset.value;
                const valueB = rowB.cells[column].dataset.value;
                const comparison = field === 'name'
                    ? valueA.localeCompare(valueB, 'ru', { sensitivity: 'base' })
                    : Number(valueA) - Number(valueB);
                return currentSortDir === 'asc' ? comparison : -comparison;
            });

            rows.forEach((row, index) => {
                tbody.appendChild(row);
                row.cells[0].textContent = index + 1;
            });

            table.querySelectorAll('.sort-icon').forEach(icon => {
                icon.innerHTML = '<i class="bi bi-arrow-down-up"></i>';
            });
            const activeIcon = this.querySelector('.sort-icon');
            activeIcon.innerHTML = currentSortDir === 'asc'
                ? '<i class="bi bi-arrow-up"></i>'
                : '<i class="bi bi-arrow-down"></i>';
        });
    });
}

(function() {
    function init() {
        const dataElement = document.getElementById('item-price-data');
        const items = dataElement ? JSON.parse(dataElement.textContent) : [];
        initItemPriceAnalytics(items);
        initAnalyticsTableSorting();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
