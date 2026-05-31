const saleItemsGrid = document.getElementById('itemsGrid');
const saleItemSearch = document.getElementById('itemSearch');
const saleCategoryFilter = document.getElementById('categoryFilter');
const saleCartList = document.getElementById('saleCartList');
const saleSubtotal = document.getElementById('saleSubtotal');
const saleTotal = document.getElementById('saleTotal');
const saleChange = document.getElementById('saleChange');
const saleDiscount = document.getElementById('saleDiscount');
const cashReceived = document.getElementById('cashReceived');
const completeSaleButton = document.getElementById('completeSaleBtn');
const clearCartButton = document.getElementById('clearCartBtn');
const saleMessage = document.getElementById('saleMessage');
const receiptPrintArea = document.getElementById('receiptPrintArea');

let saleItems = [];
let cart = [];

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
    return Number(price).toLocaleString(undefined, {
        style: 'currency',
        currency: 'PKR'
    });
}

function getCategories() {
    return [...new Set(saleItems.map((item) => item.category || 'General'))].sort();
}

function renderCategoryFilter() {
    const selectedCategory = saleCategoryFilter.value || 'all';
    const categories = getCategories();

    saleCategoryFilter.innerHTML = `
        <option value="all">All categories</option>
        ${categories.map((category) => `
            <option value="${escapeHTML(category)}">${escapeHTML(category)}</option>
        `).join('')}
    `;

    if (categories.includes(selectedCategory)) {
        saleCategoryFilter.value = selectedCategory;
    }
}

function getFilteredItems() {
    const query = saleItemSearch.value.trim().toLowerCase();
    const selectedCategory = saleCategoryFilter.value;

    return saleItems.filter((item) => {
        const matchesSearch = [item.name, item.category].some((value) => {
            return String(value || '').toLowerCase().includes(query);
        });
        const matchesCategory = selectedCategory === 'all' || (item.category || 'General') === selectedCategory;

        return matchesSearch && matchesCategory;
    });
}

function renderSaleItems(list = saleItems) {
    if (!list.length) {
        saleItemsGrid.innerHTML = '<p class="items-empty">No products found.</p>';
        return;
    }

    const groupedItems = list.reduce((groups, item) => {
        const category = item.category || 'General';

        if (!groups[category]) {
            groups[category] = [];
        }

        groups[category].push(item);
        return groups;
    }, {});

    saleItemsGrid.innerHTML = Object.entries(groupedItems).map(([category, categoryItems]) => `
        <section class="category-group">
            <div class="category-heading">
                <h3>${escapeHTML(category)}</h3>
                <span>${categoryItems.length} product${categoryItems.length === 1 ? '' : 's'}</span>
            </div>
            <div class="category-items-grid">
                ${categoryItems.map((item) => `
                    <article class="item-card sale-product-card" data-id="${item._id}">
                        <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy">
                        <div class="item-card-body">
                            <span class="category-pill">${escapeHTML(item.category || 'General')}</span>
                            <h3>${escapeHTML(item.name)}</h3>
                            <p>${formatPrice(item.price)}</p>
                            <button class="add-to-cart-btn" type="button" data-id="${item._id}">Add to cart</button>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `).join('');
}

function applySaleFilters() {
    renderSaleItems(getFilteredItems());
}

function getCartSubtotal() {
    return cart.reduce((sum, cartItem) => {
        return sum + Number(cartItem.price) * cartItem.quantity;
    }, 0);
}

function renderCart() {
    if (!cart.length) {
        saleCartList.innerHTML = '<p class="cart-empty">No products selected.</p>';
    } else {
        saleCartList.innerHTML = cart.map((cartItem) => `
            <article class="cart-line">
                <div>
                    <h3>${escapeHTML(cartItem.name)}</h3>
                    <p>${formatPrice(cartItem.price)} each</p>
                </div>
                <div class="qty-control">
                    <button type="button" data-action="decrease" data-id="${cartItem.id}">-</button>
                    <span>${cartItem.quantity}</span>
                    <button type="button" data-action="increase" data-id="${cartItem.id}">+</button>
                </div>
                <strong>${formatPrice(Number(cartItem.price) * cartItem.quantity)}</strong>
                <button class="remove-cart-item" type="button" data-action="remove" data-id="${cartItem.id}">Remove</button>
            </article>
        `).join('');
    }

    updateTotals();
}

function updateTotals() {
    const subtotal = getCartSubtotal();
    const discount = Math.max(0, Number(saleDiscount.value) || 0);
    const total = Math.max(0, subtotal - discount);
    const received = Math.max(0, Number(cashReceived.value) || 0);

    saleSubtotal.textContent = formatPrice(subtotal);
    saleTotal.textContent = formatPrice(total);
    saleChange.textContent = formatPrice(received - total);
}

function addToCart(itemId) {
    const item = saleItems.find((currentItem) => currentItem._id === itemId);

    if (!item) {
        return;
    }

    const existingCartItem = cart.find((cartItem) => cartItem.id === itemId);

    if (existingCartItem) {
        existingCartItem.quantity += 1;
    } else {
        cart.push({
            id: item._id,
            name: item.name,
            category: item.category || 'General',
            price: Number(item.price),
            quantity: 1
        });
    }

    saleMessage.textContent = '';
    renderCart();
}

function updateCartQuantity(itemId, change) {
    const cartItem = cart.find((currentCartItem) => currentCartItem.id === itemId);

    if (!cartItem) {
        return;
    }

    cartItem.quantity += change;

    if (cartItem.quantity <= 0) {
        cart = cart.filter((currentCartItem) => currentCartItem.id !== itemId);
    }

    renderCart();
}

function removeCartItem(itemId) {
    cart = cart.filter((cartItem) => cartItem.id !== itemId);
    renderCart();
}

function clearCart() {
    cart = [];
    saleDiscount.value = 0;
    cashReceived.value = 0;
    saleMessage.textContent = '';
    renderCart();
}

function formatReceiptDate(value) {
    return new Date(value || Date.now()).toLocaleString();
}

function buildReceiptHTML(sale) {
    const receiptItems = sale.items.map((saleItem) => `
        <tr>
            <td>
                <strong>${escapeHTML(saleItem.name)}</strong>
                <span>${escapeHTML(saleItem.category || 'General')}</span>
            </td>
            <td>${saleItem.quantity}</td>
            <td>${formatPrice(saleItem.price)}</td>
            <td>${formatPrice(saleItem.lineTotal)}</td>
        </tr>
    `).join('');

    return `
        <div class="receipt">
            <div class="receipt-header">
                <h1>FLOW POS</h1>
                <p>Sale Receipt</p>
                <p>${formatReceiptDate(sale.createdAt)}</p>
                <p>Receipt #: ${escapeHTML(sale._id)}</p>
                <p>Cashier: ${escapeHTML(sale.cashier || 'Unknown')}</p>
            </div>

            <table class="receipt-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>${receiptItems}</tbody>
            </table>

            <div class="receipt-summary">
                <div><span>Subtotal</span><strong>${formatPrice(sale.subtotal)}</strong></div>
                <div><span>Discount</span><strong>${formatPrice(sale.discount)}</strong></div>
                <div class="receipt-total"><span>Total</span><strong>${formatPrice(sale.total)}</strong></div>
                <div><span>Cash</span><strong>${formatPrice(sale.cashReceived)}</strong></div>
                <div><span>Change</span><strong>${formatPrice(sale.change)}</strong></div>
            </div>

            <div class="receipt-footer">
                <p>Thank you for shopping!</p>
            </div>
        </div>
    `;
}

function printReceipt(sale) {
    receiptPrintArea.innerHTML = buildReceiptHTML(sale);

    setTimeout(() => {
        window.print();
    }, 150);
}

async function completeSale() {
    saleMessage.textContent = '';

    if (!cart.length) {
        saleMessage.textContent = 'Add at least one product to complete a sale.';
        return;
    }

    const subtotal = getCartSubtotal();
    const discount = Math.max(0, Number(saleDiscount.value) || 0);
    const total = Math.max(0, subtotal - discount);
    const received = Math.max(0, Number(cashReceived.value) || 0);

    if (received < total) {
        saleMessage.textContent = 'Cash received is less than the total.';
        return;
    }

    completeSaleButton.disabled = true;
    completeSaleButton.textContent = 'Saving...';

    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: cart.map((cartItem) => ({
                    id: cartItem.id,
                    quantity: cartItem.quantity
                })),
                discount,
                cashReceived: received
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to complete sale');
        }

        saleMessage.textContent = `Sale completed. Change: ${formatPrice(received - total)}`;
        printReceipt(data);
        cart = [];
        saleDiscount.value = 0;
        cashReceived.value = 0;
        renderCart();
    } catch (error) {
        saleMessage.textContent = error.message;
    } finally {
        completeSaleButton.disabled = false;
        completeSaleButton.textContent = 'Complete Sale';
    }
}

async function loadSaleItems() {
    saleItemsGrid.innerHTML = '<p class="items-empty">Loading products...</p>';

    try {
        const response = await fetch('/api/items');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to load products');
        }

        saleItems = data;
        renderCategoryFilter();
        applySaleFilters();
    } catch (error) {
        saleItemsGrid.innerHTML = `<p class="items-empty">${error.message}</p>`;
    }
}

saleItemsGrid.addEventListener('click', (event) => {
    const addButton = event.target.closest('.add-to-cart-btn');
    const productCard = event.target.closest('.sale-product-card');
    const itemId = addButton?.dataset.id || productCard?.dataset.id;

    if (itemId) {
        addToCart(itemId);
    }
});

saleCartList.addEventListener('click', (event) => {
    const button = event.target.closest('button');

    if (!button) {
        return;
    }

    if (button.dataset.action === 'increase') {
        updateCartQuantity(button.dataset.id, 1);
    }

    if (button.dataset.action === 'decrease') {
        updateCartQuantity(button.dataset.id, -1);
    }

    if (button.dataset.action === 'remove') {
        removeCartItem(button.dataset.id);
    }
});

saleItemSearch.addEventListener('input', applySaleFilters);
saleCategoryFilter.addEventListener('change', applySaleFilters);
saleDiscount.addEventListener('input', updateTotals);
cashReceived.addEventListener('input', updateTotals);
completeSaleButton.addEventListener('click', completeSale);
clearCartButton.addEventListener('click', clearCart);

renderCart();
loadSaleItems();
