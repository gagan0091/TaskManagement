const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");
const { ROLES } = require("../config/constants");
const { getPagination, buildPagination } = require("../utils/pagination");


// Admin: list users (to pick an assignee for a task)
const getUsers = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = { organization: req.user.organization };

        if (req.query.role) {
            filter.role = String(req.query.role);
        }

        if (req.query.search) {
            const rx = new RegExp(escapeRegex(req.query.search), "i");
            filter.$or = [{ name: rx }, { email: rx }];
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("-password")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: users,
            pagination: buildPagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// Admin: create a user with a specific role
const createUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            throw new AppError("Name, email and password are required", 400);
        }

        if (password.length < 6) {
            throw new AppError("Password must be at least 6 characters", 400);
        }


        const exists = await User.findOne({ email: email.toLowerCase() });

        if (exists) {
            throw new AppError("User already exists", 409);
        }

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: await bcrypt.hash(password, 10),
            role: ROLES.USER,                     // hamesha normal user
            organization: req.user.organization 
        });

        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        next(error);
    }
};

// Admin: change a user's role
const updateUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;

        if (!Object.values(ROLES).includes(role)) {
            throw new AppError(`Role must be one of: ${Object.values(ROLES).join(", ")}`, 400);
        }

        if (req.params.id === req.user.userId) {
            throw new AppError("You cannot change your own role", 400);
        }

        const user = await User.findOneAndUpdate(
            { _id: req.params.id, organization: req.user.organization },
            { role },
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            throw new AppError("User not found", 404);
        }

        res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data: user
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getUsers, createUser, updateUserRole };
