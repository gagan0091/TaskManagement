const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const withTransaction = require("../utils/withTransaction");
const { ROLES } = require("../config/constants");

const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN
        }
    );
};


// Admins are created via  an existing admin (POST /api/users).
const register = async (req, res, next) => {
    try {
        const { name, email, password, organizationName } = req.body;

        if (!name || !email || !password || !organizationName) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and organizationName are required"
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await withTransaction(async (session) => {
            const orgId = new mongoose.Types.ObjectId();
            const userId = new mongoose.Types.ObjectId();

            await Organization.create(
                [{ _id: orgId, name: organizationName, owner: userId }],
                { session }
            );

            const [createdUser] = await User.create(
                [{
                    _id: userId,
                    name,
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: ROLES.ADMIN,
                    organization: orgId
                }],
                { session }
            );

            return createdUser;
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: "Organization and admin account created successfully",
            data: {
                user: {
                    id: user._id, name: user.name, email: user.email,
                    role: user.role, organization: user.organization
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("-password");

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getProfile
};
