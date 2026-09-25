require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Frontend:  http://localhost:${PORT}/login`);
        console.log(`API base:  http://localhost:${PORT}/api`);
    });
};

startServer();
