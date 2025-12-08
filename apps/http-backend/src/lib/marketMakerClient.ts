import { MarketMaker } from "../market-maker"
import { redis } from "./redis"

const DEFAULT_SEED = Number(process.env.MARKET_MAKER_SEED || 10_000)
const DEFAULT_SENSITIVITY = Number(process.env.MARKET_MAKER_SENSITIVITY || 0.5)
const DEFAULT_DECIMALS = Number(process.env.MARKET_MAKER_DECIMALS || 2)

export const marketMaker = new MarketMaker(redis, {
    seedLiquidity: DEFAULT_SEED,
    sensitivity: DEFAULT_SENSITIVITY,
    decimals: DEFAULT_DECIMALS,
})
