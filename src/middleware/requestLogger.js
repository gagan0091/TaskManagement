// Logs every incoming request and its result. Request body is NOT logged
// (it can contain passwords).
const requestLogger = (req, res, next) => {
    const start = Date.now();

    console.log(
        `[REQ] ${new Date().toISOString()} | ${req.method} ${req.originalUrl}`
    );

    res.on("finish", () => {
        const who = req.user
            ? `${req.user.role}:${req.user.userId}`
            : "anonymous";

        console.log(
            `[RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} | ${Date.now() - start}ms | ${who}`
        );
    });

    next();
};

module.exports = requestLogger;
