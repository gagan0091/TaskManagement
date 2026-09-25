const Product = require("../models/Product");
const RawMaterial = require("../models/RawMaterial");
const Task = require("../models/Task");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");
const { getPagination, buildPagination } = require("../utils/pagination");

const validateMaterials = async (materials, organization) => {
    if (!Array.isArray(materials) || materials.length === 0) {
        throw new AppError("At least one raw material is required", 400);
    }

    const ids = materials.map((m) => String(m.material));

    if (new Set(ids).size !== ids.length) {
        throw new AppError("Same raw material added more than once", 400);
    }

    materials.forEach((m) => {
        if (!m.material || !(Number(m.quantityPerUnit) > 0)) {
            throw new AppError("Each material needs material id and quantityPerUnit > 0", 400);
        }
    });

    const count = await RawMaterial.countDocuments({ _id: { $in: ids }, organization: organization });

    if (count !== ids.length) {
        throw new AppError("One or more raw materials do not exist", 404);
    }
};

const createProduct = async (req, res, next) => {
    try {
        const { name, sku, description, materials } = req.body;

        if (!name || !sku) {
            throw new AppError("Name and sku are required", 400);
        }
        console.log("Creating product with materials:", materials);

        await validateMaterials(materials, req.user.organization);

        const product = await Product.create({
            name,
            sku,
            description,
            materials,
            createdBy: req.user.userId,
            organization: req.user.organization
        });

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });
    } catch (error) {
        next(error);
    }
};

const getProducts = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = {};
        filter.organization = req.user.organization;

        if (req.query.search) {
            const rx = new RegExp(escapeRegex(req.query.search), "i");
            filter.$or = [{ name: rx }, { sku: rx }];
        }

        if (req.query.isActive !== undefined) {
            filter.isActive = req.query.isActive === "true";
        }
        console.log("Fetching products with filter:", filter, "Page:", page, "Limit:", limit);
        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("materials.material", "name sku unit quantity"),
            Product.countDocuments(filter)
        ]);
        console.log("Products fetched:", products.length, "Total:", total);

        res.status(200).json({
            success: true,
            data: products,
            pagination: buildPagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, organization: req.user.organization })
            .populate("materials.material", "name sku unit quantity");

        if (!product) {
            throw new AppError("Product not found", 404);
        }

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};

// Recipe changes only affect NEW tasks. Existing tasks keep their own snapshot.
const updateProduct = async (req, res, next) => {
    try {
        const allowedFields = ["name", "sku", "description", "materials", "isActive"];
        const updates = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (updates.materials) {
            await validateMaterials(updates.materials, req.user.organization);
        }

        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, organization: req.user.organization },
            updates,
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {
            throw new AppError("Product not found", 404);
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product
        });
    } catch (error) {
        next(error);
    }
};

const deleteProduct = async (req, res, next) => {
    try {
        const used = await Task.exists({ product: req.params.id });

        if (used) {
            throw new AppError("Product is used in tasks. Set isActive=false instead of deleting", 409);
        }

        const product = await Product.findOneAndDelete({
            _id: req.params.id,
            organization: req.user.organization
        });

        if (!product) {
            throw new AppError("Product not found", 404);
        }

        res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
};
