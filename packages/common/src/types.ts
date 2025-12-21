import type { Request } from "express";
import type { ZodTypeAny } from "zod";

export type Side = "YES" | "NO";

export type OrderInMem = {
    id: string;
    userId: string;
    side: Side;
    price: number; 
    qty: number;   
    createdAt: number; 
    isExit?: boolean;
};

export type TradeMsg = {
    tradeId: string;
    side: Side;
    price: number;
    qty: number;
    taker: string;
    maker: string;
    makerOrderId:string,
    remainingMakerQty:number,
    ts: number;
};

export type ValidatedInput = {
    body?: unknown;
    params?: unknown;
    query?: unknown;
};

export interface AuthRequest extends Request {
    userId?: string;
    role?: string;
    validated?: ValidatedInput;
}

export interface TokenPayload {
    id: string;
    role?: string;
}

export type SchemaHandler = {
    body?: ZodTypeAny;
    params?: ZodTypeAny;
    query?: ZodTypeAny;
};

export type MarketMakerSnapshot = {
    eventId: string;
    priceYesPaise: string;
    priceNoPaise: string;
    decimals: number;
    seedLiquidity: number;
    sensitivity: number;
    inventoryYes: number;
    inventoryNo: number;
    netYesExposure: number;
    lastUpdated: number;
};
