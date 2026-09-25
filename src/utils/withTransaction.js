const mongoose = require("mongoose");

/**
 * Runs `work(session)` inside a MongoDB transaction.
 * - Commits if work resolves, aborts if it throws.
 * - Retries automatically on transient transaction errors,
 *   so `work` must only do DB operations (no emails, no external calls).
 * - Never use Promise.all with the same session inside `work`.
 */
const withTransaction = async (work) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } finally {
        session.endSession();
    }
};

module.exports = withTransaction;
