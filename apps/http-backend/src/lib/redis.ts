import Redis from "ioredis"

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    retryStrategy: attempt => Math.min(attempt * 200, 2_000),
})
