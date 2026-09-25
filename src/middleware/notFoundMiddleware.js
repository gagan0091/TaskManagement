const notFound = (req, res) => {
    // Browser pages get a friendly HTML 404, API consumers keep the JSON contract
    if (!req.path.startsWith("/api")) {
        return res.status(404).render("errors/404", { title: "Not Found" });
    }

    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
};

module.exports = notFound;
