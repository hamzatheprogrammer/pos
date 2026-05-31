    const salesTableBody = document.getElementById('salesTableBody');
    const salesSearch = document.getElementById('salesSearch');
    const exportSalesExcel = document.getElementById('exportSalesExcel');
    const reportTotalSales = document.getElementById('reportTotalSales');
    const reportTotalRevenue = document.getElementById('reportTotalRevenue');
    const reportItemsSold = document.getElementById('reportItemsSold');

    let sales = [];

    function escapeHTML(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[character];
        });
    }

    function formatPrice(price) {
        return Number(price || 0).toLocaleString(undefined, {
            style: 'currency',
            currency: 'PKR'
        });
    }

    function formatDate(value) {
        return new Date(value).toLocaleString();
    }

    function getSaleItemsText(sale) {
        return sale.items.map((item) => {
            return `${item.name} (${item.category || 'General'}) x${item.quantity} @ ${formatPrice(item.price)}`;
        }).join('; ');
    }

    function getFilteredSales() {
        const query = salesSearch.value.trim().toLowerCase();

        return sales.filter((sale) => {
            const fields = [
                sale._id,
                sale.cashier,
                formatDate(sale.createdAt),
                getSaleItemsText(sale),
                sale.total
            ];

            return fields.some((field) => String(field || '').toLowerCase().includes(query));
        });
    }

    function updateSummary() {
        const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        const totalItems = sales.reduce((sum, sale) => {
            return sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0);
        }, 0);

        reportTotalSales.textContent = sales.length;
        reportTotalRevenue.textContent = formatPrice(totalRevenue);
        reportItemsSold.textContent = totalItems;
    }

    function renderSales(list = sales) {
        if (!list.length) {
            salesTableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No sales found.</td></tr>';
            return;
        }

        salesTableBody.innerHTML = list.map((sale) => `
            <tr>
                <td>${escapeHTML(sale._id)}</td>
                <td>${escapeHTML(formatDate(sale.createdAt))}</td>
                <td>${escapeHTML(sale.cashier || 'Unknown')}</td>
                <td>${escapeHTML(getSaleItemsText(sale))}</td>
                <td>${formatPrice(sale.subtotal)}</td>
                <td>${formatPrice(sale.discount)}</td>
                <td>${formatPrice(sale.total)}</td>
                <td>${formatPrice(sale.cashReceived)}</td>
                <td>${formatPrice(sale.change)}</td>
            </tr>
        `).join('');
    }

    async function loadSales() {
        salesTableBody.innerHTML = '<tr><td colspan="9" class="empty-state">Loading sales...</td></tr>';

        try {
            const response = await fetch('/api/sales');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Unable to load sales');
            }

            sales = data;
            updateSummary();
            renderSales();
        } catch (error) {
            salesTableBody.innerHTML = `<tr><td colspan="9" class="empty-state">${error.message}</td></tr>`;
        }
    }

    function downloadSalesExcel() {
        const exportRows = getFilteredSales();

        if (!exportRows.length) {
            alert('No sales available to export.');
            return;
        }

        const rows = exportRows.map((sale) => `
            <tr>
                <td>${escapeHTML(sale._id)}</td>
                <td>${escapeHTML(formatDate(sale.createdAt))}</td>
                <td>${escapeHTML(sale.cashier || 'Unknown')}</td>
                <td>${escapeHTML(getSaleItemsText(sale))}</td>
                <td>${escapeHTML(sale.subtotal)}</td>
                <td>${escapeHTML(sale.discount)}</td>
                <td>${escapeHTML(sale.total)}</td>
                <td>${escapeHTML(sale.cashReceived)}</td>
                <td>${escapeHTML(sale.change)}</td>
            </tr>
        `).join('');
        const worksheet = `
            <html>
                <head><meta charset="UTF-8"></head>
                <body>
                    <table>
                        <thead>
                            <tr>
                                <th>Receipt</th>
                                <th>Date</th>
                                <th>Cashier</th>
                                <th>Items</th>
                                <th>Subtotal</th>
                                <th>Discount</th>
                                <th>Total</th>
                                <th>Cash Received</th>
                                <th>Change</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </body>
            </html>
        `;
        const blob = new Blob([worksheet], {
            type: 'application/vnd.ms-excel;charset=utf-8'
        });
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);

        link.href = URL.createObjectURL(blob);
        link.download = `sales-report-${date}.xls`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    }

    salesSearch.addEventListener('input', () => {
        renderSales(getFilteredSales());
    });

    exportSalesExcel.addEventListener('click', downloadSalesExcel);

    loadSales();
