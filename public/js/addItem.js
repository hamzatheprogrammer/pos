const addItemForm = document.getElementById('addItemForm');
const itemNameInput = document.getElementById('ItemName');
const itemPriceInput = document.getElementById('ItemPrice');
const itemImageInput = document.getElementById('ItemImage');
const itemCategoryInput = document.getElementById('ItemCategory');
const itemStockInput = document.getElementById('ItemStock');
const itemIdInput = document.getElementById('ItemId');
const itemFormMessage = document.getElementById('itemFormMessage');
const itemsGrid = document.getElementById('itemsGrid');
const itemSearch = document.getElementById('itemSearch');
const openAddItemModal = document.getElementById('openAddItemModal');
const itemModalElement = document.getElementById('exampleModal');
const itemModalTitle = document.getElementById('exampleModalLabel');
const saveItemButton = document.getElementById('saveItemBtn');
const categoryFilter = document.getElementById('categoryFilter');
const downloadExcelButton = document.getElementById('downloadExcelBtn');

let items = [];

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

function renderItems(list = items) {
    if (!list.length) {
        itemsGrid.innerHTML = '<p class="items-empty">No items added yet.</p>';
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

    itemsGrid.innerHTML = Object.entries(groupedItems).map(([category, categoryItems]) => `
        <section class="category-group">
            <div class="category-heading">
                <h3>${escapeHTML(category)}</h3>
                <span>${categoryItems.length} product${categoryItems.length === 1 ? '' : 's'}</span>
            </div>
            <div class="category-items-grid">
                ${categoryItems.map((item) => `
                    <article class="item-card">
                        <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy">
                        <div class="item-card-body">
                            <span class="category-pill">${escapeHTML(item.category || 'General')}</span>
                            <h3>${escapeHTML(item.name)}</h3>
                            <p>${formatPrice(item.price)}</p>
                            ${item.stock !== undefined && item.stock !== null
        ? `<p class="item-stock">Stock: ${escapeHTML(item.stock)}</p>`
        : ''}
                            <div class="item-card-actions">
                                <button class="table-btn edit-btn" type="button" data-id="${item._id}">Edit</button>
                                <button class="table-btn delete-btn" type="button" data-id="${item._id}">Delete</button>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `).join('');
}

function getCategories() {
    return [...new Set(items.map((item) => item.category || 'General'))].sort();
}

function renderCategoryFilter() {
    const selectedCategory = categoryFilter.value || 'all';
    const categories = getCategories();

    categoryFilter.innerHTML = `
        <option value="all">All categories</option>
        ${categories.map((category) => `
            <option value="${escapeHTML(category)}">${escapeHTML(category)}</option>
        `).join('')}
    `;

    if (categories.includes(selectedCategory)) {
        categoryFilter.value = selectedCategory;
    }
}

function applyItemFilters() {
    renderItems(getFilteredItems());
}

function getFilteredItems() {
    const query = itemSearch.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;

    return items.filter((item) => {
        const matchesSearch = [item.name, item.category].some((value) => {
            return String(value || '').toLowerCase().includes(query);
        });
        const matchesCategory = selectedCategory === 'all' || (item.category || 'General') === selectedCategory;

        return matchesSearch && matchesCategory;
    });
}

function downloadItemsAsExcel() {
    const exportItems = getFilteredItems();

    if (!exportItems.length) {
        alert('No items available to download.');
        return;
    }

    const rows = exportItems.map((item) => `
        <tr>
            <td>${escapeHTML(item.name)}</td>
            <td>${escapeHTML(item.category || 'General')}</td>
            <td>${escapeHTML(item.price)}</td>
        </tr>
    `).join('');
    const worksheet = `
        <html>
            <head>
                <meta charset="UTF-8">
            </head>
            <body>
                <table>
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Price</th>
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
    link.download = `products-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

function resetItemForm() {
    addItemForm.reset();
    itemIdInput.value = '';
    itemFormMessage.textContent = '';
    itemModalTitle.textContent = 'Add New Item';
    saveItemButton.textContent = 'Save Item';
}

function openEditModal(item) {
    itemIdInput.value = item._id;
    itemImageInput.value = item.image;
    itemNameInput.value = item.name;
    itemCategoryInput.value = item.category || 'General';
    itemPriceInput.value = item.price;
    itemStockInput.value = item.stock !== undefined && item.stock !== null ? item.stock : '';
    itemFormMessage.textContent = '';
    itemModalTitle.textContent = 'Edit Item';
    saveItemButton.textContent = 'Update Item';

    const modal = bootstrap.Modal.getOrCreateInstance(itemModalElement);
    modal.show();
}

async function loadItems() {
    itemsGrid.innerHTML = '<p class="items-empty">Loading items...</p>';

    try {
        const response = await fetch('/api/items');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to load items');
        }

        items = data;
        renderCategoryFilter();
        applyItemFilters();
    } catch (error) {
        itemsGrid.innerHTML = `<p class="items-empty">${error.message}</p>`;
    }
}

addItemForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    itemFormMessage.textContent = '';

    const payload = {
        name: itemNameInput.value.trim(),
        price: itemPriceInput.value,
        image: itemImageInput.value.trim(),
        category: itemCategoryInput.value.trim()
    };

    if (itemStockInput.value !== '') {
        payload.stock = itemStockInput.value;
    }
    const itemId = itemIdInput.value;

    try {
        const response = await fetch(itemId ? `/api/items/${itemId}` : '/api/items', {
            method: itemId ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to add item');
        }

        if (itemId) {
            items = items.map((item) => item._id === itemId ? data : item);
        } else {
            items = [data, ...items];
        }

        renderCategoryFilter();
        applyItemFilters();
        resetItemForm();

        const modal = bootstrap.Modal.getInstance(itemModalElement);
        modal?.hide();
    } catch (error) {
        itemFormMessage.textContent = error.message;
    }
});

itemsGrid.addEventListener('click', async (event) => {
    const editButton = event.target.closest('.edit-btn');
    const deleteButton = event.target.closest('.delete-btn');

    if (editButton) {
        const item = items.find((currentItem) => currentItem._id === editButton.dataset.id);

        if (item) {
            openEditModal(item);
        }
    }

    if (deleteButton) {
        const item = items.find((currentItem) => currentItem._id === deleteButton.dataset.id);
        const itemName = item?.name || 'this item';

        if (!confirm(`Delete ${itemName}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/items/${deleteButton.dataset.id}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || 'Unable to delete item');
            }

            items = items.filter((currentItem) => currentItem._id !== deleteButton.dataset.id);
            renderCategoryFilter();
            applyItemFilters();
        } catch (error) {
            alert(error.message);
        }
    }
});

openAddItemModal.addEventListener('click', resetItemForm);
itemModalElement.addEventListener('hidden.bs.modal', resetItemForm);

itemSearch.addEventListener('input', () => {
    applyItemFilters();
});

categoryFilter.addEventListener('change', applyItemFilters);
downloadExcelButton.addEventListener('click', downloadItemsAsExcel);

loadItems();
