const mongoose = require("mongoose");
const Task = require("../models/Task");
const Product = require("../models/Product");
const User = require("../models/User");
const RawMaterial = require("../models/RawMaterial");
const AppError = require("../utils/AppError");
const withTransaction = require("../utils/withTransaction");
const escapeRegex = require("../utils/escapeRegex");
const { changeStock, round3 } = require("../services/inventoryService");
const { getPagination, buildPagination } = require("../utils/pagination");
const { ROLES, TASK_STATUS, INVENTORY_TX } = require("../config/constants");

const populateTask = [
    { path: "product", select: "name sku" },
    { path: "assignedTo", select: "name email" },
    { path: "createdBy", select: "name email" }
];

const ALLOWED_TRANSITIONS = {
    [TASK_STATUS.PENDING]: [TASK_STATUS.IN_PROGRESS],
    [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.COMPLETED],
    [TASK_STATUS.COMPLETED]: []
};

// admin sees everything, a normal user only sees tasks assigned to them
  const visibilityFilter = (req) => {
      const base = { organization: req.user.organization };
      return req.user.role === ROLES.ADMIN ? base : { ...base, assignedTo: req.user.userId };
  };
/**
 * ADMIN: create task + allocate raw material.
 * In ONE transaction:
 *   1. validate assignee + product
 *   2. check stock for every material
 *   3. deduct stock (+ ledger entry per material)
 *   4. create task with materialsUsed snapshot
 * Anything fails -> everything rolls back.
 */
const createTask = async (req, res, next) => {
    try {
        const {
            title,
            description,
            priority,
            dueDate,
            product: productId,
            quantity,
            assignedTo
        } = req.body;

        if (!title || !productId || !assignedTo || quantity === undefined) {
            throw new AppError("title, product, quantity and assignedTo are required", 400);
        }
        console.log("req.user =", req.user);
console.log("organization =", req.user.organization);

        const qty = Number(quantity);

        if (!Number.isInteger(qty) || qty < 1) {
            throw new AppError("Quantity must be a positive whole number", 400);
        }

        const createdTask = await withTransaction(async (session) => {
            const assignee = await User.findOne({ _id: assignedTo, organization: req.user.organization }).session(session);

            if (!assignee) {
                throw new AppError("Assigned user not found", 404);
            }

            const product = await Product.findOne({ _id: productId, organization: req.user.organization }).session(session);

            if (!product || !product.isActive) {
                throw new AppError("Product not found or inactive", 404);
            }

            if (product.materials.length === 0) {
                throw new AppError("Product has no raw materials defined", 400);
            }

            const required = product.materials.map((m) => ({
                material: m.material,
                quantity: round3(m.quantityPerUnit * qty)
            }));

            // Friendly shortage report (the atomic check in changeStock is the real guard)
            const stock = await RawMaterial.find({ 
                _id: { $in: required.map((r) => r.material) },
                organization: req.user.organization
            }).session(session);

            const stockMap = new Map(stock.map((s) => [s._id.toString(), s]));
            const shortages = [];

            for (const r of required) {
                const s = stockMap.get(r.material.toString());

                if (!s) {
                    shortages.push(`Material ${r.material} no longer exists`);
                } else if (s.quantity < r.quantity) {
                    shortages.push(
                        `${s.name}: required ${r.quantity} ${s.unit}, available ${s.quantity} ${s.unit}`
                    );
                }
            }

            if (shortages.length) {
                throw new AppError("Insufficient raw material stock", 400, shortages);
            }

            const taskId = new mongoose.Types.ObjectId();
            const materialsUsed = [];

            // sequential on purpose: one session cannot run parallel operations
            for (const r of required) {
                const material = await changeStock({
                    materialId: r.material,
                    delta: -r.quantity,
                    type: INVENTORY_TX.TASK_CONSUMPTION,
                    performedBy: req.user.userId,
                    task: taskId,
                    product: product._id,
                    note: `Allocated for task "${title}" (${qty} x ${product.name})`,
                    organization: req.user.organization,
                    session
                });

                materialsUsed.push({
                    material: material._id,
                    name: material.name,
                    unit: material.unit,
                    quantity: r.quantity
                });
            }

            const [task] = await Task.create(
                [
                    {
                        _id: taskId,
                        title,
                        description,
                        priority,
                        dueDate,
                        product: product._id,
                        quantity: qty,
                        materialsUsed,
                        createdBy: req.user.userId,
                        assignedTo,
                        statusHistory: [
                            { status: TASK_STATUS.PENDING, changedBy: req.user.userId }
                        ],
                        organization: req.user.organization
                    }
                ],
                { session }
            );

            return task;
        });

        const task = await Task.findById(createdTask._id).populate(populateTask);

        res.status(201).json({
            success: true,
            message: "Task created and raw material allocated successfully",
            data: task
        });
    } catch (error) {
        next(error);
    }
};

const getTasks = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const { status, priority, search, product, assignedTo } = req.query;

        const filter = visibilityFilter(req); 
        

        if (status) filter.status = String(status);
        if (priority) filter.priority = String(priority);
        if (product) filter.product = String(product);

        // only admin can filter by another user; normal user is already locked to own tasks
        if (assignedTo && req.user.role === ROLES.ADMIN) {
            filter.assignedTo = String(assignedTo);
        }

        if (search) {
            const rx = new RegExp(escapeRegex(search), "i");
            filter.$or = [{ title: rx }, { description: rx }];
        }

        const [tasks, totalTasks] = await Promise.all([
            Task.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate(populateTask),
            Task.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: tasks,
            pagination: buildPagination(page, limit, totalTasks)
        });
    } catch (error) {
        next(error);
    }
};

const getTaskById = async (req, res, next) => {
    try {
        const task = await Task.findOne({
            _id: req.params.id,
            ...visibilityFilter(req)
        }).populate(populateTask);

        if (!task) {
            throw new AppError("Task not found", 404);
        }

        res.status(200).json({ success: true, data: task });
    } catch (error) {
        next(error);
    }
};

// ADMIN: edit task details / reassign. Product & quantity are locked because
// inventory is already allocated - delete the task and create a new one instead.
const updateTask = async (req, res, next) => {
    try {
        const allowedFields = ["title", "description", "priority", "dueDate", "assignedTo"];
        const updates = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (updates.assignedTo) {
            const assignee = await User.exists({ _id: updates.assignedTo });

            if (!assignee) {
                throw new AppError("Assigned user not found", 404);
            }
        }

        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, organization: req.user.organization },
            updates,
            {
                new: true,
                runValidators: true
            }
        ).populate(populateTask);

        if (!task) {
            throw new AppError("Task not found", 404);
        }

        res.status(200).json({
            success: true,
            message: "Task updated successfully",
            data: task
        });
    } catch (error) {
        next(error);
    }
};

// Assigned user (or admin): pending -> in-progress -> completed
// On completion the produced units are added to Product.stockQuantity.
const updateTaskStatus = async (req, res, next) => {
    try {
        const { status } = req.body;

        if (!Object.values(TASK_STATUS).includes(status)) {
            throw new AppError(
                `Status must be one of: ${Object.values(TASK_STATUS).join(", ")}`,
                400
            );
        }

        const taskId = await withTransaction(async (session) => {
            const task = await Task.findOne({ 
                _id: req.params.id,
                ...visibilityFilter(req)
            }).session(session);

            if (!task) {
                throw new AppError("Task not found", 404);
            }

            if (!ALLOWED_TRANSITIONS[task.status].includes(status)) {
                throw new AppError(
                    `Cannot change status from "${task.status}" to "${status}"`,
                    400
                );
            }

            const now = new Date();
            task.status = status;

            if (status === TASK_STATUS.IN_PROGRESS) {
                task.startedAt = now;
            }

            if (status === TASK_STATUS.COMPLETED) {
                task.completedAt = now;

                await Product.updateOne(
                    { _id: task.product },
                    { $inc: { stockQuantity: task.quantity } },
                    { session }
                );
            }

            task.statusHistory.push({
                status,
                changedBy: req.user.userId,
                changedAt: now
            });

            await task.save({ session });

            return task._id;
        });

        const task = await Task.findById(taskId).populate(populateTask);

        res.status(200).json({
            success: true,
            message: "Task status updated successfully",
            data: task
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: delete task and REVERT the allocated inventory (one transaction).
 * Each revert is written to the inventory history (TASK_REVERT).
 * Completed tasks can't be deleted: the product is already produced, so the
 * raw material was really consumed.
 */
const deleteTask = async (req, res, next) => {
    try {
        await withTransaction(async (session) => {
            const task = await Task.findById(req.params.id).session(session);

            if (!task) {
                throw new AppError("Task not found", 404);
            }

            if (task.status === TASK_STATUS.COMPLETED) {
                throw new AppError(
                    "Completed task cannot be deleted because its raw material is already consumed",
                    409
                );
            }

            for (const used of task.materialsUsed) {
                await changeStock({
                    materialId: used.material,
                    delta: used.quantity,
                    type: INVENTORY_TX.TASK_REVERT,
                    performedBy: req.user.userId,
                    task: task._id,
                    product: task.product,
                    note: `Reverted: task "${task.title}" deleted by admin`,
                    organization: req.user.organization,
                    session
                });
            }

            await Task.deleteOne({ _id: task._id }, { session });
        });

        res.status(200).json({
            success: true,
            message: "Task deleted and inventory reverted successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    updateTaskStatus,
    deleteTask
};
