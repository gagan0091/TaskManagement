// The EJS frontend NEVER touches models/controllers directly - it only calls
// the same JSON API that any other client (mobile app, React app, Postman...)
// would use. This keeps the API itself framework-agnostic and swappable.
const BASE_URL = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

class ApiError extends Error {
    constructor(message, status, errors) {
        super(message);
        this.status = status || 500;
        this.errors = errors;
    }
}

const apiRequest = async (req, method, path, body) => {
    const headers = { "Content-Type": "application/json" };

const token = req.cookies?.token;

if (token) {
    headers.Authorization = `Bearer ${token}`;
}

    let response;

    try {
        console.log(`API Request: ${method} ${BASE_URL}${path}`, body ? { body } : {});
        response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        console.log(`API Response: ${method} ${BASE_URL}${path} -> ${response.status}`);
    } catch (err) {
        throw new ApiError("Could not reach the API server", 503);
    }

    let payload = null;

    try {
        payload = await response.json();
    } catch (err) {
        // no/invalid JSON body (e.g. 204 No Content)
    }

if (response.status === 401) {
    // Web middleware invalid cookie clear करेगा.
    throw new ApiError("Unauthorized", 401);
}

    if (!response.ok || !payload || payload.success === false) {
        const message = (payload && payload.message) || `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status, payload && payload.errors);
    }

    return payload;
};

module.exports = { apiRequest, ApiError };
