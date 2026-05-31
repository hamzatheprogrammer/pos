const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();






const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String,
    role: {
        type: String,
        default: 'user'
    }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const ItemRecipeIngredientSchema = new mongoose.Schema({
    material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RawMaterial',
        required: true
    },
    quantityPerUnit: {
        type: Number,
        required: true,
        min: 0.001
    }
}, { _id: false });

const ItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true,
        default: 'General'
    },
    stock: {
        type: Number,
        min: 0
    },
    recipeIngredients: {
        type: [ItemRecipeIngredientSchema],
        default: []
    }
}, {
    timestamps: true
});

const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);

const SaleSchema = new mongoose.Schema({
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        category: {
            type: String,
            default: 'General'
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        lineTotal: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    cashReceived: {
        type: Number,
        default: 0,
        min: 0
    },
    change: {
        type: Number,
        default: 0
    },
    cashier: {
        type: String,
        default: 'Unknown'
    }
}, {
    timestamps: true
});

const Sale = mongoose.models.Sale || mongoose.model('Sale', SaleSchema);

const RawMaterialSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    unit: {
        type: String,
        required: true,
        trim: true,
        default: 'pcs'
    },
    quantityOnHand: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    reorderLevel: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

const RawMaterial = mongoose.models.RawMaterial || mongoose.model('RawMaterial', RawMaterialSchema);

const RecipeIngredientSchema = new mongoose.Schema({
    material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RawMaterial',
        required: true
    },
    quantityPerUnit: {
        type: Number,
        required: true,
        min: 0.001
    }
}, { _id: false });

const RecipeSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true,
        unique: true
    },
    ingredients: {
        type: [RecipeIngredientSchema],
        default: []
    }
}, {
    timestamps: true
});

const Recipe = mongoose.models.Recipe || mongoose.model('Recipe', RecipeSchema);

function normalizeId(value) {
    if (!value) {
        return '';
    }

    if (value._id) {
        return String(value._id);
    }

    return String(value);
}

function getSaleIngredients(saleItemId, recipes, products) {
    const recipe = recipes.find((entry) => normalizeId(entry.item) === saleItemId);
    const product = products.find((entry) => normalizeId(entry._id) === saleItemId);

    if (recipe?.ingredients?.length) {
        return recipe.ingredients;
    }

    if (product?.recipeIngredients?.length) {
        return product.recipeIngredients;
    }

    return [];
}

async function buildRawDeductions(saleItems) {
    const deductions = new Map();
    const itemIds = saleItems.map((saleItem) => saleItem.item);

    const [recipes, products] = await Promise.all([
        Recipe.find({ item: { $in: itemIds } }).lean(),
        Item.find({ _id: { $in: itemIds } }).select('recipeIngredients').lean()
    ]);

    for (const saleItem of saleItems) {
        const saleItemId = normalizeId(saleItem.item);
        const ingredients = getSaleIngredients(saleItemId, recipes, products);

        for (const ingredient of ingredients) {
            const materialId = normalizeId(ingredient.material);

            if (!materialId) {
                continue;
            }

            const needed = Number(ingredient.quantityPerUnit) * saleItem.quantity;

            if (!needed || needed <= 0) {
                continue;
            }

            deductions.set(materialId, (deductions.get(materialId) || 0) + needed);
        }
    }

    return deductions;
}

async function deductProductStock(saleItems) {
    for (const saleItem of saleItems) {
        const product = await Item.findById(saleItem.item).select('name stock');

        if (!product || product.stock === undefined || product.stock === null) {
            continue;
        }

        const updated = await Item.findOneAndUpdate(
            { _id: saleItem.item, stock: { $gte: saleItem.quantity } },
            { $inc: { stock: -saleItem.quantity } },
            { new: true }
        );

        if (!updated) {
            throw new Error(
                `Not enough "${product.name}" in stock. Need ${saleItem.quantity}, have ${product.stock}.`
            );
        }
    }
}

async function validateRawStock(deductions) {
    for (const [materialId, quantity] of deductions) {
        const material = await RawMaterial.findById(materialId);

        if (!material) {
            throw new Error('A recipe references a raw material that no longer exists');
        }

        if (material.quantityOnHand < quantity) {
            throw new Error(
                `Not enough "${material.name}" in stock. Need ${quantity} ${material.unit}, have ${material.quantityOnHand} ${material.unit}.`
            );
        }
    }
}

async function applyRawDeductions(deductions) {
    for (const [materialId, quantity] of deductions) {
        const updated = await RawMaterial.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(materialId), quantityOnHand: { $gte: quantity } },
            { $inc: { quantityOnHand: -quantity } },
            { new: true }
        );

        if (!updated) {
            const material = await RawMaterial.findById(materialId);
            const name = material ? material.name : 'raw material';
            throw new Error(`Could not deduct stock for "${name}". Stock may have changed during checkout.`);
        }
    }
}

router.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }

    res.sendFile(__dirname + '/public/login.html');
}
);

router.get('/login', (req, res) => {

    res.sendFile(__dirname + '/public/login.html');

});

router.post('/login', async (req, res) => {

    const { username, password } = req.body;

    try {

        const user = await User.findOne({ username, password });

        if (!user) {
            return res.status(401).json({ message: "Invalid username or password" });
        }


        req.session.user = {
            id: user._id,
            username: user.username,
            role: user.role
        };


        req.session.save(() => {
            return res.status(200).json({ message: "Login successful" });
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get('/dashboard', (req, res) => {

    if (!req.session.user) {
        return res.sendFile(__dirname + '/public/login.html');

    }

    res.sendFile(__dirname + '/public/dashboard.html');
});
router.get('/user', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).sendFile(__dirname + '/public/login.html');
    }

    res.sendFile(__dirname + '/public/user.html');
});

router.get('/api/users', async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const users = await User.find({}).select('-password');
        return res.json(users);
    } catch (err) {
        return res.status(500).json({ message: "Server Error" });
    }
});

router.post('/api/users', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { username, email, role, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
    }

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(409).json({ message: "A user with this name already exists" });
        }

        const user = await User.create({
            username,
            email,
            role: role || 'user',
            password
        });

        const userObject = user.toObject();
        delete userObject.password;

        return res.status(201).json(userObject);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.put('/api/users/:id', async (req, res) => {
    if (!req.session.user) {

        return res.status(401).json({ message: "Unauthorized" });
    }

    const { username, email, role, password } = req.body;

    if (!username || !email) {
        return res.status(400).json({ message: "Name and email are required" });
    }

    try {
        const update = {
            username,
            email,
            role: role || 'user'
        };

        if (password) {
            update.password = password;
        }

        const user = await User.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true
        }).select('-password');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.delete('/api/users/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({ message: "User deleted" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get('/api/role', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    return res.json({ 'role': req.session.user.role });
});

router.get('/sale', (req, res) => {
    if (!req.session.user) {
        return res.status(401).sendFile(__dirname + '/public/login.html');
    }

    res.sendFile(__dirname + '/public/sale.html');

});

router.get('/additem', (req, res) => {
    if (!req.session.user) {
        return res.status(401).sendFile(__dirname + '/public/login.html');
    }

    res.sendFile(__dirname + '/public/additem.html');

});

router.get('/inventory', (req, res) => {
    if (!req.session.user) {
        return res.status(401).sendFile(__dirname + '/public/login.html');
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.redirect('/dashboard');
    }

    res.sendFile(__dirname + '/public/inventory.html');
});

router.post('/api/items', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { name, price, image, category, stock } = req.body;

    if (!name || !price || !image || !category) {
        return res.status(400).json({ message: "Name, price, image, and category are required" });
    }

    try {
        const payload = {
            name,
            price: Number(price),
            image,
            category
        };

        if (stock !== undefined && stock !== null && stock !== '') {
            payload.stock = Math.max(0, Number(stock) || 0);
        }

        const item = await Item.create(payload);

        return res.status(201).json(item);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get('/api/items', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const items = await Item.find({}).sort({ createdAt: -1 });
        return res.json(items);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.put('/api/items/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { name, price, image, category, stock } = req.body;

    if (!name || !price || !image || !category) {
        return res.status(400).json({ message: "Name, price, image, and category are required" });
    }

    try {
        const update = {
            name,
            price: Number(price),
            image,
            category
        };

        if (stock !== undefined && stock !== null && stock !== '') {
            update.stock = Math.max(0, Number(stock) || 0);
        }

        const item = await Item.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true
        });

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        return res.json(item);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.delete('/api/items/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const item = await Item.findByIdAndDelete(req.params.id);

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        return res.json({ message: "Item deleted" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.post('/api/sales', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { items, discount = 0, cashReceived = 0 } = req.body;

    if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({ message: "Sale must include at least one item" });
    }

    try {
        const itemIds = items.map((saleItem) => saleItem.id);
        const products = await Item.find({ _id: { $in: itemIds } });
        const saleItems = items.map((saleItem) => {
            const product = products.find((currentProduct) => {
                return currentProduct._id.toString() === saleItem.id;
            });

            if (!product) {
                throw new Error("One or more products no longer exist");
            }

            const quantity = Math.max(1, Number(saleItem.quantity) || 1);
            const price = Number(product.price);

            return {
                item: product._id,
                name: product.name,
                category: product.category || 'General',
                price,
                quantity,
                lineTotal: price * quantity
            };
        });
        const subtotal = saleItems.reduce((sum, saleItem) => sum + saleItem.lineTotal, 0);
        const cleanDiscount = Math.max(0, Number(discount) || 0);
        const total = Math.max(0, subtotal - cleanDiscount);
        const cleanCashReceived = Math.max(0, Number(cashReceived) || 0);
        const deductions = await buildRawDeductions(saleItems);
        await validateRawStock(deductions);
        await deductProductStock(saleItems);

        const sale = await Sale.create({
            items: saleItems,
            subtotal,
            discount: cleanDiscount,
            total,
            cashReceived: cleanCashReceived,
            change: cleanCashReceived - total,
            cashier: req.session.user.username
        });

        try {
            if (deductions.size) {
                await applyRawDeductions(deductions);
            }
        } catch (deductError) {
            await Sale.findByIdAndDelete(sale._id);

            for (const saleItem of saleItems) {
                const product = await Item.findById(saleItem.item).select('stock');

                if (product && product.stock !== undefined && product.stock !== null) {
                    await Item.findByIdAndUpdate(saleItem.item, { $inc: { stock: saleItem.quantity } });
                }
            }

            throw deductError;
        }

        return res.status(201).json(sale);
    } catch (err) {
        console.error(err);
        const status = err.message && (
            /stock/i.test(err.message) ||
            /Not enough/i.test(err.message) ||
            /deduct/i.test(err.message)
        ) ? 400 : 500;
        return res.status(status).json({ message: err.message || "Server Error" });
    }
});

router.get('/api/sales', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const sales = await Sale.find({}).sort({ createdAt: -1 }).limit(200);
        return res.json(sales);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get("/api/items/count", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const totalItems = await Item.countDocuments();
        const result = await Item.aggregate([
            {
                $group: {
                    _id: "$category",
                    total: { $sum: 1 }
                }
            }
        ]);

        
        return res.json({ totalItems,  result });

    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get("/reports", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).sendFile(__dirname + '/public/login.html');
    }
    
    res.sendFile(__dirname + '/public/reports.html');
});

router.get('/api/raw-materials', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const materials = await RawMaterial.find({}).sort({ name: 1 });
        return res.json(materials);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.post('/api/raw-materials', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.status(403).json({ message: "Forbidden" });
    }

    const { name, unit, quantityOnHand = 0, reorderLevel = 0 } = req.body;

    if (!name || !unit) {
        return res.status(400).json({ message: "Name and unit are required" });
    }

    try {
        const material = await RawMaterial.create({
            name: String(name).trim(),
            unit: String(unit).trim(),
            quantityOnHand: Math.max(0, Number(quantityOnHand) || 0),
            reorderLevel: Math.max(0, Number(reorderLevel) || 0)
        });

        return res.status(201).json(material);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.put('/api/raw-materials/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.status(403).json({ message: "Forbidden" });
    }

    const { name, unit, reorderLevel } = req.body;

    if (!name || !unit) {
        return res.status(400).json({ message: "Name and unit are required" });
    }

    try {
        const material = await RawMaterial.findByIdAndUpdate(req.params.id, {
            name: String(name).trim(),
            unit: String(unit).trim(),
            reorderLevel: Math.max(0, Number(reorderLevel) || 0)
        }, {
            new: true,
            runValidators: true
        });

        if (!material) {
            return res.status(404).json({ message: "Raw material not found" });
        }

        return res.json(material);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.patch('/api/raw-materials/:id/stock', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.status(403).json({ message: "Forbidden" });
    }

    const { amount } = req.body;

    if (amount === undefined || amount === null || Number(amount) === 0) {
        return res.status(400).json({ message: "A non-zero amount is required" });
    }

    try {
        const material = await RawMaterial.findById(req.params.id);

        if (!material) {
            return res.status(404).json({ message: "Raw material not found" });
        }

        const delta = Number(amount);
        const nextQuantity = material.quantityOnHand + delta;

        if (nextQuantity < 0) {
            return res.status(400).json({ message: "Stock cannot go below zero" });
        }

        material.quantityOnHand = nextQuantity;
        await material.save();

        return res.json(material);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.delete('/api/raw-materials/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.status(403).json({ message: "Forbidden" });
    }

    try {
        const material = await RawMaterial.findByIdAndDelete(req.params.id);

        if (!material) {
            return res.status(404).json({ message: "Raw material not found" });
        }

        await Recipe.updateMany(
            {},
            { $pull: { ingredients: { material: material._id } } }
        );

        return res.json({ message: "Raw material deleted" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get('/api/recipes', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const recipes = await Recipe.find({})
            .populate('item', 'name category price')
            .populate('ingredients.material', 'name unit quantityOnHand');
        return res.json(recipes);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.put('/api/recipes/:itemId', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.status(403).json({ message: "Forbidden" });
    }

    const { ingredients } = req.body;

    if (!Array.isArray(ingredients)) {
        return res.status(400).json({ message: "Ingredients must be an array" });
    }

    try {
        const item = await Item.findById(req.params.itemId);

        if (!item) {
            return res.status(404).json({ message: "Product not found" });
        }

        const cleanIngredients = [];

        for (const entry of ingredients) {
            const materialId = entry.materialId || entry.material;
            const quantityPerUnit = Number(entry.quantityPerUnit);

            if (!materialId || !quantityPerUnit || quantityPerUnit <= 0) {
                continue;
            }

            const material = await RawMaterial.findById(materialId);

            if (!material) {
                return res.status(400).json({ message: "One or more raw materials were not found" });
            }

            cleanIngredients.push({
                material: material._id,
                quantityPerUnit
            });
        }

        const recipe = await Recipe.findOneAndUpdate(
            { item: item._id },
            { ingredients: cleanIngredients },
            { new: true, upsert: true, runValidators: true }
        )
            .populate('item', 'name category price')
            .populate('ingredients.material', 'name unit quantityOnHand');

        await Item.findByIdAndUpdate(item._id, { recipeIngredients: cleanIngredients });

        return res.json(recipe);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.delete('/api/recipes/:itemId', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.status(403).json({ message: "Forbidden" });
    }

    try {
        const recipe = await Recipe.findOneAndDelete({ item: req.params.itemId });

        if (!recipe) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        await Item.findByIdAndUpdate(req.params.itemId, { recipeIngredients: [] });

        return res.json({ message: "Recipe removed" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

async function syncRecipeIngredientsToItems() {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    try {
        const recipes = await Recipe.find({ 'ingredients.0': { $exists: true } }).lean();

        await Promise.all(recipes.map((recipe) => {
            return Item.findByIdAndUpdate(recipe.item, { recipeIngredients: recipe.ingredients });
        }));
    } catch (err) {
        console.error('Recipe sync failed:', err.message);
    }
}

if (mongoose.connection.readyState === 1) {
    syncRecipeIngredientsToItems();
} else {
    mongoose.connection.on('connected', syncRecipeIngredientsToItems);
}

module.exports = router;
