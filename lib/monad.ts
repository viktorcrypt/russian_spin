// lib/monad.ts
import { defineChain } from "viem";

export const MONAD_CHAIN_ID = 10143;

// возьмём из .env.local, а если нет — дефолтный RPC
export const RPC =
  process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.monad.xyz";

// hex-вид для EIP-1193 методов
export const CHAIN_HEX = `0x${MONAD_CHAIN_ID.toString(16)}`;

// описание сети в стиле viem
export const monadChain = {
  id: MONAD_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC] },
    public: { http: [RPC] },
  },
  blockExplorers: {
    default: { name: "MonVision", url: "https://testnet.monadexplorer.com" },
  },
} as const;

// готовая для viem цепочка
export const monadTestnet = defineChain(monadChain);
