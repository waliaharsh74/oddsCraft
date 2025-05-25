export type Side = "YES" | "NO";

export type OrderInMem = {
    id: string;
    userId: string;
    side: Side;
    price: number; 
    qty: number;   
    createdAt: number; 
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
