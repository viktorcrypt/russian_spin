// app/api/submit-onchain/route.ts
import { NextResponse } from "next/server";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const runtime = "nodejs";

// Мини-описание сети (RPC берём из env)
const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.MONAD_RPC_URL!] } },
} as const;

// ABI только с нужной функцией
const monadGamesAbi = [
  {
    type: "function",
    name: "updatePlayerData",
    stateMutability: "nonpayable",
    inputs: [
      { name: "player", type: "address" },
      { name: "scoreAmount", type: "uint256" },
      { name: "transactionAmount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export async function POST(req: Request) {
  try {
    // ожидаем { player: "0x...", score: number, txCount?: number }
    const { player, score, txCount } = await req.json();

    if (!player || typeof score !== "number") {
      return NextResponse.json(
        { ok: false, error: "bad payload: need { player, score }" },
        { status: 400 }
      );
    }

    // ── server signer (как в Anti-Beat) ───────────────────────────────
    const pkRaw = (process.env.SERVER_PRIVATE_KEY || "").trim();
    if (!pkRaw) {
      return NextResponse.json(
        { ok: false, error: "SERVER_PRIVATE_KEY missing" },
        { status: 500 }
      );
    }
    const pk = (pkRaw.startsWith("0x") ? pkRaw : `0x${pkRaw}`) as `0x${string}`;
    const account = privateKeyToAccount(pk);

    const rpc = process.env.MONAD_RPC_URL;
    if (!rpc) {
      return NextResponse.json(
        { ok: false, error: "MONAD_RPC_URL missing" },
        { status: 500 }
      );
    }

    const registry = process.env.MONAD_GAMES_ID_CONTRACT as `0x${string}`;
    if (!registry) {
      return NextResponse.json(
        { ok: false, error: "MONAD_GAMES_ID_CONTRACT missing" },
        { status: 500 }
      );
    }

    const client = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(rpc),
    });

    // Важно: Ровно ТРИ аргумента, как в гайде
    const txHash = await client.writeContract({
      address: registry,
      abi: monadGamesAbi,
      functionName: "updatePlayerData",
      args: [
        player as `0x${string}`,
        BigInt(score),
        BigInt(typeof txCount === "number" ? txCount : 1), // можно передать 1
      ],
      account,
    });

    return NextResponse.json({ ok: true, tx: txHash, score, used: "updatePlayerData" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
