const errorHandler = (err, req, res, next) => {
    if (err.isOperational) {
        console.error(`[ERROR] ${req.method} ${req.originalUrl} -> ${err.message}`);
    } else {
        console.error(err);
    }

    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(err.errors && { errors: err.errors })
        });
    }

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON body"
        });
    }

    if (err.name === "ValidationError") {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: Object.values(err.errors).map(
                (error) => error.message
            )
        });
    }

    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }

    if (err.code === 11000) {
        const fields = Object.keys(err.keyValue || {});
        return res.status(409).json({
            success: false,
            message: `Duplicate value for: ${fields.join(", ") || "unique field"}`
        });
    }

    if (/replica set|Transaction numbers/i.test(err.message || "")) {
        console.error(
            "[HINT] MongoDB transactions need a replica set (or Atlas). See docker-compose.yml."
        );
    }

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};

module.exports = errorHandler;
