import { EventEmitter } from "events"
import { prisma, Role } from "@repo/db"
import { OrderBook, TradeMsg, REDIS_CHANNELS, redisKeys, RedisChannel } from "@repo/common"
import { logger } from "../lib/logger"
import { redis } from "../lib/redis"

export const DEFAULT_DECIMALS = 2
export const LIQUIDATION_PRICE = 5

const PLATFORM_USER_ID = process.env.PLATFORM_USER_ID

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const books = new Map<string, OrderBook>()

export const bus = new EventEmitter()
bus.on("trade", (msg) => {
    redis.xadd(redisKeys.tradesStream, "*", "data", JSON.stringify(msg))
})

const publish = (channel: RedisChannel, payload: unknown) => {
    const serialized = JSON.stringify(payload)
    redis.publish(channel, serialized)
    persistLastPayload(channel, serialized, payload)
}

const persistLastPayload = (channel: RedisChannel, serializedPayload: string, payload: unknown) => {
    if (!payload || typeof payload !== "object") return
    const eventId = (payload as { eventId?: string }).eventId
    if (!eventId) return

    let key: string | null = null
    if (channel === REDIS_CHANNELS.depth) key = redisKeys.lastDepth(eventId)
    if (channel === REDIS_CHANNELS.pricing) key = redisKeys.lastPricing(eventId)
    if (!key) return

    redis.set(key, serializedPayload).catch((err) => logger.error({ err, channel, eventId }, "Failed to persist Redis payload"))
}

bus.on("trade", (payload) => publish(REDIS_CHANNELS.trade, payload))
bus.on("depth", (payload) => publish(REDIS_CHANNELS.depth, payload))

export const getBook = (eventId: string) => {
    if (!books.has(eventId)) books.set(eventId, new OrderBook())
    return books.get(eventId)!
}

export const publishDepth = (eventId: string) => {
    const book = books.get(eventId)
    if (!book) return
    bus.emit("depth", {
        eventId,
        depth: { bids: book.depth("YES"), asks: book.depth("NO") },
    })
}

export const publishTrades = (eventId: string, trades: TradeMsg[]) => {
    bus.emit("trade", { eventId, trades })
}

export const toMinorUnits = (value: number, decimal = DEFAULT_DECIMALS) => {
    const factor = Math.pow(10, decimal)
    return BigInt(Math.round(value * factor))
}

export const fromMinorUnits = (value: string, decimal = DEFAULT_DECIMALS) =>
    Number(BigInt(value)) / Math.pow(10, decimal)

export const addMinorUnits = (value: string, delta: bigint) => (BigInt(value) + delta).toString()

export const calcStake = (price: number, qty: number, decimal = DEFAULT_DECIMALS) => toMinorUnits(price, decimal) * BigInt(qty)

export async function resolvePlatformUser(tx: TxClient | typeof prisma = prisma) {
    if (PLATFORM_USER_ID) {
        const explicit = await tx.user.findUnique({ where: { id: PLATFORM_USER_ID } })
        if (explicit) return explicit
        throw new Error("platform_user_missing")
    }

    const existingAdmin = await tx.user.findFirst({ where: { role: Role.ADMIN }, orderBy: { createdAt: "asc" } })
    if (existingAdmin) return existingAdmin

    throw new Error("platform_user_missing")
}
