const Redis = require("ioredis");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

let redisClient;

const getRedisClient = () => {
    if (!redisClient) {
        redisClient = new Redis(
            process.env.REDIS_URL || "redis://127.0.0.1:6379",
            {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                retryStrategy: (attempt) =>
                    attempt > 5 ? null : Math.min(attempt * 200, 1000)
            }
        );
    }

    return redisClient;
};

const createAuthRateLimiter = ({
    name,
    limit,
    windowMs,
    store,
    skip = () => process.env.NODE_ENV === "test"
}) => rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: store || new RedisStore({
        prefix: `flowforge:auth:${name}:`,
        sendCommand: (command, ...args) =>
            getRedisClient().call(command, ...args)
    }),
    skip,
    message: {
        success: false,
        error: {
            code: "AUTH_RATE_LIMITED",
            message: "Too many attempts. Please try again later."
        }
    }
});

const loginRateLimit = createAuthRateLimiter({
    name: "login",
    limit: 10,
    windowMs: 15 * 60 * 1000
});

const registrationRateLimit = createAuthRateLimiter({
    name: "register",
    limit: 5,
    windowMs: 60 * 60 * 1000
});

const closeAuthRateLimitStore = async () => {
    if (redisClient) {
        if (redisClient.status === "ready") {
            await redisClient.quit();
        } else {
            redisClient.disconnect();
        }
        redisClient = null;
    }
};

const connectAuthRateLimitStore = async () => {
    await getRedisClient().ping();
};

module.exports = {
    loginRateLimit,
    registrationRateLimit,
    closeAuthRateLimitStore,
    connectAuthRateLimitStore,
    createAuthRateLimiter
};
