// import { Side } from "@repo/common"
// import { prisma, type MarketMakerState as MarketMakerStateRow } from "@repo/db"
// import Redis from "ioredis"

// type MarketMakerConfig = {
//     seedLiquidity: number
//     sensitivity: number
//     initialPrice: number
//     minPrice: number
//     maxPrice: number
//     decimals: number
//     redisKeyPrefix: string
// }

// export type MarketMakerState = {
//     eventId: string
//     priceYesPaise: string
//     priceNoPaise: string
//     decimals: number
//     seedLiquidity: number
//     sensitivity: number
//     inventoryYes: number
//     inventoryNo: number
//     netYesExposure: number
//     lastUpdated: number
// }

// export type TradeImpact = {
//     side: Side
//     qty: number
//     price?: number
//     decimals?: number
// }

// const DEFAULT_CONFIG: MarketMakerConfig = {
//     seedLiquidity: 10_000,
//     sensitivity: 0.5,
//     initialPrice: 5,
//     minPrice: 0.5,
//     maxPrice: 9.5,
//     decimals: 2,
//     redisKeyPrefix: "mm:state:",
// }

// const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)

// const toMinorUnits = (value: number, decimals: number) => {
//     const factor = Math.pow(10, decimals)
//     return BigInt(Math.round(value * factor)).toString()
// }

// const fromMinorUnits = (value: string, decimals: number) => {
//     const factor = Math.pow(10, decimals)
//     return Number(BigInt(value)) / factor
// }


// export class MarketMaker {
//     private config: MarketMakerConfig
//     private redis: Redis

//     constructor(redis: Redis, overrides?: Partial<MarketMakerConfig>) {
//         this.redis = redis
//         this.config = { ...DEFAULT_CONFIG, ...overrides }
//     }

//     async getState(eventId: string): Promise<MarketMakerState | null> {
//         const cached = await this.redis.get(this.key(eventId))
//         if (cached) {
//             try {
//                 return JSON.parse(cached) as MarketMakerState
//             } catch {
//             }
//         }

//         const row = await prisma.marketMakerState.findUnique({ where: { eventId } })
//         if (!row) return null

//         const state = this.fromDb(row)
//         await this.cacheState(state)
//         return state
//     }

//     async seedMarket(eventId: string, overrides?: Partial<Pick<MarketMakerConfig, "seedLiquidity" | "sensitivity" | "initialPrice" | "decimals">>): Promise<MarketMakerState> {
//         const existing = await this.getState(eventId)
//         if (existing) return existing

//         const seedLiquidity = overrides?.seedLiquidity ?? this.config.seedLiquidity
//         const sensitivity = overrides?.sensitivity ?? this.config.sensitivity
//         const decimals = overrides?.decimals ?? this.config.decimals
//         const priceYes = overrides?.initialPrice ?? this.config.initialPrice
//         const priceNo = 10 - priceYes

//         const state: MarketMakerState = {
//             eventId,
//             decimals,
//             seedLiquidity,
//             sensitivity,
//             priceYesPaise: toMinorUnits(priceYes, decimals),
//             priceNoPaise: toMinorUnits(priceNo, decimals),
//             inventoryYes: seedLiquidity,
//             inventoryNo: seedLiquidity,
//             netYesExposure: 0,
//             lastUpdated: Date.now(),
//         }

//         await this.persistState(state)
//         return state
//     }

//     async applyTrades(eventId: string, trades: TradeImpact[], decimalsOverride?: number): Promise<MarketMakerState> {
//         let state = await this.ensureState(eventId, decimalsOverride)
//         if (!trades.length) return state

//         let working = { ...state }
//         const decimals = decimalsOverride ?? working.decimals ?? this.config.decimals

//         for (const trade of trades) {
//             working = this.applyTradeToState(working, { ...trade, decimals: trade.decimals ?? decimals })
//         }

//         working.decimals = decimals
//         working.lastUpdated = Date.now()

//         await this.persistState(working)
//         return working
//     }

//     async getQuote(eventId: string): Promise<{ priceYes: number; priceNo: number; state: MarketMakerState }> {
//         const state = await this.ensureState(eventId)
//         const decimals = state.decimals ?? this.config.decimals
//         return {
//             priceYes: fromMinorUnits(state.priceYesPaise, decimals),
//             priceNo: fromMinorUnits(state.priceNoPaise, decimals),
//             state,
//         }
//     }

//     async reset(eventId: string) {
//         await Promise.all([
//             prisma.marketMakerState.deleteMany({ where: { eventId } }),
//             this.redis.del(this.key(eventId)),
//         ])
//     }

//     private applyTradeToState(state: MarketMakerState, trade: TradeImpact): MarketMakerState {
//         const decimals = trade.decimals ?? state.decimals ?? this.config.decimals
//         const priceYes = fromMinorUnits(state.priceYesPaise, decimals)
//         const delta = (trade.qty / state.seedLiquidity) * state.sensitivity
//         const adjustedYes = trade.side === "YES" ? priceYes + delta : priceYes - delta
//         const nextPriceYes = clamp(adjustedYes, this.config.minPrice, this.config.maxPrice)
//         const nextPriceNo = 10 - nextPriceYes

//         const netYesExposure = state.netYesExposure + (trade.side === "YES" ? trade.qty : -trade.qty)
//         const inventoryYes = Math.max(0, state.inventoryYes - (trade.side === "YES" ? trade.qty : 0))
//         const inventoryNo = Math.max(0, state.inventoryNo - (trade.side === "NO" ? trade.qty : 0))

//         return {
//             ...state,
//             decimals,
//             netYesExposure,
//             inventoryYes,
//             inventoryNo,
//             priceYesPaise: toMinorUnits(nextPriceYes, decimals),
//             priceNoPaise: toMinorUnits(nextPriceNo, decimals),
//         }
//     }

//     private async ensureState(eventId: string, decimals?: number): Promise<MarketMakerState> {
//         const existing = await this.getState(eventId)
//         if (existing) return existing
//         return this.seedMarket(eventId, { decimals })
//     }

//     private async persistState(state: MarketMakerState) {
//         const payload = this.toDb(state)
//         console.log('reached here');
        
//         const stored = await prisma.marketMakerState.upsert({
//             where: { eventId: state.eventId },
//             update: payload,
//             create: payload,
//         })

//         const normalized = this.fromDb(stored)
//         await this.cacheState(normalized)
//     }

//     private key(eventId: string) {
//         return `${this.config.redisKeyPrefix}${eventId}`
//     }

//     private toDb(state: MarketMakerState) {
//         return {
//             eventId: state.eventId,
//             priceYesPaise: state.priceYesPaise,
//             priceNoPaise: state.priceNoPaise,
//             decimals: state.decimals,
//             seedLiquidity: state.seedLiquidity,
//             sensitivity: state.sensitivity,
//             inventoryYes: state.inventoryYes,
//             inventoryNo: state.inventoryNo,
//             netYesExposure: state.netYesExposure,
//             lastUpdated: new Date(state.lastUpdated),
//         }
//     }

//     private fromDb(row: MarketMakerStateRow): MarketMakerState {
//         return {
//             eventId: row.eventId,
//             priceYesPaise: row.priceYesPaise,
//             priceNoPaise: row.priceNoPaise,
//             decimals: row.decimals,
//             seedLiquidity: row.seedLiquidity,
//             sensitivity: row.sensitivity,
//             inventoryYes: row.inventoryYes,
//             inventoryNo: row.inventoryNo,
//             netYesExposure: row.netYesExposure,
//             lastUpdated: row.lastUpdated.getTime(),
//         }
//     }

//     private async cacheState(state: MarketMakerState) {
//         await this.redis.set(this.key(state.eventId), JSON.stringify(state))
//     }
// }
