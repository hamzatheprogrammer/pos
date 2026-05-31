const rawMaterialsBody = document.getElementById('rawMaterialsBody');
const rawSearch = document.getElementById('rawSearch');
const rawMaterialForm = document.getElementById('rawMaterialForm');
const rawMaterialIdInput = document.getElementById('rawMaterialId');
const rawNameInput = document.getElementById('rawName');
const rawUnitInput = document.getElementById('rawUnit');
const rawQuantityInput = document.getElementById('rawQuantity');
const rawReorderInput = document.getElementById('rawReorder');
const rawFormMessage = document.getElementById('rawFormMessage');
const rawMaterialModalLabel = document.getElementById('rawMaterialModalLabel');
const initialStockGroup = document.getElementById('initialStockGroup');
const openRawModal = document.getElementById('openRawModal');
const rawMaterialModalElement = document.getElementById('rawMaterialModal');
const restockForm = document.getElementById('restockForm');
const restockMaterialIdInput = document.getElementById('restockMaterialId');
const restockMaterialName = document.getElementById('restockMaterialName');
const restockAmountInput = document.getElementById('restockAmount');
const restockMessage = document.getElementById('restockMessage');
const restockModalElement = document.getElementById('restockModal');
const recipeProductSelect = document.getElementById('recipeProduct');
const recipeIngredientsList = document.getElementById('recipeIngredientsList');
const addRecipeLineBtn = document.getElementById('addRecipeLineBtn');
const saveRecipeBtn = document.getElementById('saveRecipeBtn');
const clearRecipeBtn = document.getElementById('clearRecipeBtn');
const recipeMessage = document.getElementById('recipeMessage');
const rawCountEl = document.getElementById('rawCount');
const lowStockCountEl = document.getElementById('lowStockCount');
const recipeCountEl = document.getElementById('recipeCount');

let rawMaterials = [];
let products = [];
let recipes = [];

const rawMaterialModal = rawMaterialModalElement
    ? bootstrap.Modal.getOrCreateInstance(rawMaterialModalElement)
    : null;
const restockModal = restockModalElement
    ? bootstrap.Modal.getOrCreateInstance(restockModalElement)
    : null;

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

function formatQty(value) {
    const number = Number(value);

    if (Number.isInteger(number)) {
        return String(number);
    }

    return number.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function getFilteredMaterials() {
    const query = rawSearch.value.trim().toLowerCase();

    return rawMaterials.filter((material) => {
        return [material.name, material.unit].some((value) => {
            return String(value || '').toLowerCase().includes(query);
        });
    });
}

function getStockStatus(material) {
    if (material.quantityOnHand <= 0) {
        return { label: 'Out of stock', className: 'stock-out' };
    }

    if (material.reorderLevel > 0 && material.quantityOnHand <= material.reorderLevel) {
        return { label: 'Low', className: 'stock-low' };
    }

    return { label: 'OK', className: 'stock-ok' };
}

function updateSummary() {
    rawCountEl.textContent = rawMaterials.length;
    lowStockCountEl.textContent = rawMaterials.filter((material) => {
        return material.quantityOnHand <= 0 ||
            (material.reorderLevel > 0 && material.quantityOnHand <= material.reorderLevel);
    }).length;
    recipeCountEl.textContent = recipes.filter((recipe) => recipe.ingredients && recipe.ingredients.length).length;
}

function renderRawMaterials() {
    const list = getFilteredMaterials();

    if (!list.length) {
        rawMaterialsBody.innerHTML = `
            <tr>
                <td colspan="6">${rawMaterials.length ? 'No materials match your search.' : 'No raw materials yet. Add one to get started.'}</td>
            </tr>
        `;
        updateSummary();
        return;
    }

    rawMaterialsBody.innerHTML = list.map((material) => {
        const status = getStockStatus(material);

        return `
            <tr>
                <td>${escapeHTML(material.name)}</td>
                <td>${escapeHTML(material.unit)}</td>
                <td>${formatQty(material.quantityOnHand)}</td>
                <td>${formatQty(material.reorderLevel)}</td>
                <td><span class="stock-pill ${status.className}">${status.label}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="table-btn edit-btn" type="button" data-action="restock" data-id="${material._id}">Stock</button>
                        <button class="table-btn edit-btn" type="button" data-action="edit-raw" data-id="${material._id}">Edit</button>
                        <button class="table-btn delete-btn" type="button" data-action="delete-raw" data-id="${material._id}">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateSummary();
}

function renderProductSelect() {
    const selected = recipeProductSelect.value;

    recipeProductSelect.innerHTML = `
        <option value="">Select a product...</option>
        ${products.map((product) => `
            <option value="${product._id}">${escapeHTML(product.name)} (${escapeHTML(product.category || 'General')})</option>
        `).join('')}
    `;

    if (products.some((product) => product._id === selected)) {
        recipeProductSelect.value = selected;
    }
}

function getRecipeForProduct(itemId) {
    return recipes.find((recipe) => {
        const recipeItemId = recipe.item?._id || recipe.item;
        return String(recipeItemId) === String(itemId);
    });
}

function buildMaterialOptions(selectedId = '') {
    if (!rawMaterials.length) {
        return '<option value="">Add raw materials first</option>';
    }

    return rawMaterials.map((material) => `
        <option value="${material._id}" ${material._id === selectedId ? 'selected' : ''}>
            ${escapeHTML(material.name)} (${escapeHTML(material.unit)})
        </option>
    `).join('');
}

function addRecipeLine(materialId = '', quantityPerUnit = '') {
    const row = document.createElement('div');
    row.className = 'recipe-ingredient-row';
    row.innerHTML = `
        <select class="recipe-material-select" aria-label="Raw material">
            ${buildMaterialOptions(materialId)}
        </select>
        <input type="number" class="recipe-qty-input" min="0.001" step="0.001" placeholder="Qty per unit" value="${quantityPerUnit}" aria-label="Quantity per unit sold">
        <button class="table-btn delete-btn" type="button" data-action="remove-line">Remove</button>
    `;
    recipeIngredientsList.appendChild(row);
}

function loadRecipeIntoBuilder(itemId) {
    recipeIngredientsList.innerHTML = '';
    recipeMessage.textContent = '';

    if (!itemId) {
        return;
    }

    const recipe = getRecipeForProduct(itemId);

    if (!recipe || !recipe.ingredients.length) {
        addRecipeLine();
        return;
    }

    recipe.ingredients.forEach((ingredient) => {
        const materialId = ingredient.material?._id || ingredient.material;
        addRecipeLine(materialId, ingredient.quantityPerUnit);
    });
}

function resetRawForm() {
    rawMaterialIdInput.value = '';
    rawNameInput.value = '';
    rawUnitInput.value = '';
    rawQuantityInput.value = '0';
    rawReorderInput.value = '0';
    rawFormMessage.textContent = '';
    rawMaterialModalLabel.textContent = 'Add Raw Material';
    initialStockGroup.style.display = '';
    openRawModal.textContent = 'Add Raw Material';
}

function openEditRaw(material) {
    rawMaterialIdInput.value = material._id;
    rawNameInput.value = material.name;
    rawUnitInput.value = material.unit;
    rawReorderInput.value = material.reorderLevel;
    rawFormMessage.textContent = '';
    rawMaterialModalLabel.textContent = 'Edit Raw Material';
    initialStockGroup.style.display = 'none';
    rawMaterialModal.show();
}

async function loadInventoryData() {
    const [materialsResponse, productsResponse, recipesResponse] = await Promise.all([
        fetch('/api/raw-materials'),
        fetch('/api/items'),
        fetch('/api/recipes')
    ]);

    const materialsData = await materialsResponse.json();
    const productsData = await productsResponse.json();
    const recipesData = await recipesResponse.json();

    if (!materialsResponse.ok) {
        throw new Error(materialsData.message || 'Unable to load raw materials');
    }

    if (!productsResponse.ok) {
        throw new Error(productsData.message || 'Unable to load products');
    }

    if (!recipesResponse.ok) {
        throw new Error(recipesData.message || 'Unable to load recipes');
    }

    rawMaterials = materialsData;
    products = productsData;
    recipes = recipesData;

    renderRawMaterials();
    renderProductSelect();

    if (recipeProductSelect.value) {
        loadRecipeIntoBuilder(recipeProductSelect.value);
    } else {
        recipeIngredientsList.innerHTML = '<p class="items-empty">Select a product to define its recipe.</p>';
    }
}

rawMaterialForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    rawFormMessage.textContent = '';

    const id = rawMaterialIdInput.value;
    const payload = {
        name: rawNameInput.value.trim(),
        unit: rawUnitInput.value.trim(),
        reorderLevel: rawReorderInput.value
    };

    if (!id) {
        payload.quantityOnHand = rawQuantityInput.value;
    }

    try {
        const response = await fetch(id ? `/api/raw-materials/${id}` : '/api/raw-materials', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to save raw material');
        }

        rawMaterialModal.hide();
        resetRawForm();
        await loadInventoryData();
    } catch (error) {
        rawFormMessage.textContent = error.message;
    }
});

restockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    restockMessage.textContent = '';

    try {
        const response = await fetch(`/api/raw-materials/${restockMaterialIdInput.value}/stock`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: restockAmountInput.value })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to update stock');
        }

        restockModal.hide();
        restockAmountInput.value = '';
        await loadInventoryData();
    } catch (error) {
        restockMessage.textContent = error.message;
    }
});

rawMaterialsBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');

    if (!button) {
        return;
    }

    const material = rawMaterials.find((entry) => entry._id === button.dataset.id);

    if (!material) {
        return;
    }

    if (button.dataset.action === 'edit-raw') {
        openEditRaw(material);
        return;
    }

    if (button.dataset.action === 'restock') {
        restockMaterialIdInput.value = material._id;
        restockMaterialName.textContent = `${material.name} — current: ${formatQty(material.quantityOnHand)} ${material.unit}`;
        restockAmountInput.value = '';
        restockMessage.textContent = '';
        restockModal.show();
        return;
    }

    if (button.dataset.action === 'delete-raw') {
        if (!window.confirm(`Delete "${material.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/raw-materials/${material._id}`, { method: 'DELETE' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Unable to delete material');
            }

            await loadInventoryData();
        } catch (error) {
            window.alert(error.message);
        }
    }
});

recipeIngredientsList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="remove-line"]');

    if (!button) {
        return;
    }

    button.closest('.recipe-ingredient-row')?.remove();

    if (!recipeIngredientsList.querySelector('.recipe-ingredient-row')) {
        addRecipeLine();
    }
});

addRecipeLineBtn.addEventListener('click', () => {
    if (recipeIngredientsList.querySelector('.items-empty')) {
        recipeIngredientsList.innerHTML = '';
    }

    addRecipeLine();
});

saveRecipeBtn.addEventListener('click', async () => {
    recipeMessage.textContent = '';

    const itemId = recipeProductSelect.value;

    if (!itemId) {
        recipeMessage.textContent = 'Select a product first.';
        return;
    }

    const ingredients = [...recipeIngredientsList.querySelectorAll('.recipe-ingredient-row')].map((row) => {
        return {
            materialId: row.querySelector('.recipe-material-select').value,
            quantityPerUnit: row.querySelector('.recipe-qty-input').value
        };
    }).filter((entry) => entry.materialId && Number(entry.quantityPerUnit) > 0);

    try {
        const response = await fetch(`/api/recipes/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredients })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to save recipe');
        }

        recipeMessage.textContent = 'Recipe saved. Sales will deduct these raw materials automatically.';
        recipeMessage.style.color = '#047857';
        await loadInventoryData();
        recipeProductSelect.value = itemId;
        loadRecipeIntoBuilder(itemId);
    } catch (error) {
        recipeMessage.style.color = '#dc2626';
        recipeMessage.textContent = error.message;
    }
});

clearRecipeBtn.addEventListener('click', async () => {
    const itemId = recipeProductSelect.value;

    if (!itemId) {
        recipeMessage.textContent = 'Select a product first.';
        return;
    }

    if (!window.confirm('Remove the recipe for this product? Sales will not deduct raw materials for it.')) {
        return;
    }

    try {
        const response = await fetch(`/api/recipes/${itemId}`, { method: 'DELETE' });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to remove recipe');
        }

        recipeMessage.textContent = 'Recipe removed.';
        await loadInventoryData();
        loadRecipeIntoBuilder(itemId);
    } catch (error) {
        recipeMessage.textContent = error.message;
    }
});

recipeProductSelect.addEventListener('change', () => {
    loadRecipeIntoBuilder(recipeProductSelect.value);
});

rawSearch.addEventListener('input', renderRawMaterials);

openRawModal.addEventListener('click', () => {
    resetRawForm();
});

rawMaterialModalElement?.addEventListener('hidden.bs.modal', resetRawForm);

loadInventoryData().catch((error) => {
    rawMaterialsBody.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`;
});
