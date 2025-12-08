export const REDIS_CHANNELS = {
    trade: "trade",
    depth: "depth",
    pricing: "market_maker_state",
} as const

export type RedisChannel = typeof REDIS_CHANNELS[keyof typeof REDIS_CHANNELS]

export const redisKeys = {
    tradesStream: "trades",
    lastDepth: (eventId: string) => `events:last_depth:${eventId}`,
    lastPricing: (eventId: string) => `events:last_pricing:${eventId}`,
    marketMakerState: (eventId: string) => `mm:state:${eventId}`,
}
