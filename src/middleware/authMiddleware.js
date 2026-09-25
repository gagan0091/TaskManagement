const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
    try {
        const token =
        req.cookies?.token ||
        req.headers.authorization?.replace("Bearer ", "");

        if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
        }

        if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
        };

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        // Role is always read from DB so role changes apply immediately
        const user = await User.findById(decoded.userId).select("name email role organization");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User no longer exists"
            });
        }

        req.user = {
            userId: user._id.toString(),
            role: user.role,
            name: user.name,
            email: user.email,
            organization: user.organization.toString()
        };

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = authenticate;
