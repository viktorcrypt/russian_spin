"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Skull, Target, RotateCw, Zap } from "lucide-react";

import {
  WagmiProvider,
  createConfig,
  http,
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Chain: Monad Testnet ──────────────────────────────────────────────────────
const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
    public: { http: ["https://testnet-rpc.monad.xyz"] },
  },
});

const config = createConfig({
  chains: [monadTestnet],
  transports: { [monadTestnet.id]: http("https://testnet-rpc.monad.xyz") },
  connectors: [injected()],
});

// ── Contract ──────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x336cc67C7A141d6d1711830EaDDC2147d3a33191" as const;
const RUSSIAN_SPIN_ABI = [
  { type: "function", name: "start", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "spin", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "cashOut", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "getSession",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "level", type: "uint8" },
      { name: "alive", type: "bool" },
      { name: "nonce", type: "uint64" },
      { name: "points", type: "uint256" },
    ],
  },
] as const;

// ── Placeholder: submit score to Monad Game ID ────────────────────────────────
async function submitScoreToGameID(score: number, opts?: { address?: string }) {
  try {
    console.log("[GameID] submit score:", score, opts?.address);
  } catch (e) {
    console.error("[GameID] score submit failed:", e);
  }
}

// ── Tiny UI (no Tailwind) ─────────────────────────────────────────────────────
function Button({
  variant = "primary",
  disabled,
  onClick,
  children,
}: {
  variant?: "primary" | "ghost" | "warning";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls = [
    "btn",
    variant === "primary" && "btn-primary",
    variant === "ghost" && "btn-ghost",
    variant === "warning" && "btn-warning",
    disabled && "btn-disabled",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}

// ── Revolver (SVG + Framer Motion) ────────────────────────────────────────────
function Revolver({
  bullets,
  lastRoll,
  spinning,
}: {
  bullets: number;
  lastRoll: number | null;
  spinning: boolean;
}) {
  const controls = useAnimation();
  const chambers = 6;

  useEffect(() => {
    if (spinning) {
      const turns = 3 + Math.random() * 2;
      const per = 360 / chambers;
      const stopAt = lastRoll == null ? 0 : lastRoll * per;
      controls.start({
        rotate: 360 * turns + stopAt,
        transition: { duration: 0.8, ease: [0.2, 0.9, 0.2, 1] },
      });
    }
  }, [spinning, lastRoll, controls]);

  return (
    <div className="rev-wrap">
      <motion.svg animate={controls} initial={{ rotate: 0 }} viewBox="0 0 200 200" className="rev-svg">
        <defs>
          <radialGradient id="metal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bbb" />
            <stop offset="100%" stopColor="#6b7280" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="90" fill="url(#metal)" stroke="#111827" strokeWidth="6" />
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const cx = 100 + Math.cos(angle) * 55;
          const cy = 100 + Math.sin(angle) * 55;
          const isBullet = i < bullets;
          const isPointer = lastRoll !== null && lastRoll === i;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="16" fill={isBullet ? "#ef4444" : "#111827"} stroke="#1f2937" strokeWidth="4" />
              {isPointer && <circle cx={cx} cy={cy} r="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="2" />}
            </g>
          );
        })}
        <polygon points="100,4 94,24 106,24" fill="#111827" />
      </motion.svg>
    </div>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen() {
  const { connect, connectors } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { writeContract, isPending } = useWriteContract();

  const [demoMode, setDemoMode] = useState(true);
  const [level, setLevel] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [alive, setAlive] = useState<boolean>(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  const bullets = useMemo(() => (level <= 0 ? 0 : Math.min(level, 5)), [level]);
  const canWrite = isConnected && !demoMode;
  const isDead = !alive && level > 0 && points === 0;

  const start = async () => {
    setLastRoll(null);
    if (canWrite) {
      await writeContract({
        abi: RUSSIAN_SPIN_ABI,
        address: CONTRACT_ADDRESS,
        functionName: "start",
        chainId: monadTestnet.id,
      });
    }
    setLevel(1);
    setPoints(10);
    setAlive(true);
  };

  const spin = async () => {
    if (!alive || spinning) return;            // ⛔️ блокируем повторный спин
    setSpinning(true);

    const roll = Math.floor(Math.random() * 6);
    const bulletsBefore = bullets;             // 🎯 фиксируем риск на момент клика

    try {
      if (canWrite) {
        await writeContract({
          abi: RUSSIAN_SPIN_ABI,
          address: CONTRACT_ADDRESS,
          functionName: "spin",
          chainId: monadTestnet.id,
        });
      }
    } finally {
      setTimeout(() => {
        setSpinning(false);
        setLastRoll(roll);
        const die = roll < bulletsBefore;      // считаем по зафиксированным bullets
        if (die) {
          setAlive(false);
          setPoints(0);
        } else {
          setPoints((p) => p * 10);
          setLevel((l) => l + 1);
        }
      }, 820);
    }
  };

  const cashOut = async () => {
    if (!alive || points <= 10) return;

    const finalScore = points;

    if (canWrite) {
      await writeContract({
        abi: RUSSIAN_SPIN_ABI,
        address: CONTRACT_ADDRESS,
        functionName: "cashOut",
        chainId: monadTestnet.id,
      });
    }

    setAlive(false);

    try {
      await submitScoreToGameID(finalScore, { address });
    } catch (e) {
      console.error("submitScoreToGameID error:", e);
    }
  };

  return (
    <div className="wrap">
      <header className="top">
        <h1 className="title title-big">
          <span className="muted">Monad</span> <span className="blood">Russian Spin</span>
        </h1>
        <div className="tools">
          <label className="checkbox">
            <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} /> Demo mode
          </label>
          {isConnected ? (
            <Button variant="ghost" onClick={() => disconnect()}>Disconnect</Button>
          ) : (
            <Button variant="ghost" onClick={() => connect({ connector: connectors[0] })}>Connect</Button>
          )}
        </div>
      </header>

      <div className="grid">
        <Card>
          <div className="meta">
            <div>Risk: <b>{bullets}/6</b></div>
            <div>Level: <b>{level || "-"}</b></div>
          </div>
          <Revolver bullets={bullets} lastRoll={lastRoll} spinning={spinning} />
          <div className="actions">
            <Button onClick={start} disabled={isPending}><RotateCw className="ico" /> Start</Button>
            <Button onClick={spin} disabled={!alive || isPending || spinning}><Target className="ico" /> {isPending ? "..." : "Spin"}</Button>
            <Button variant="warning" onClick={cashOut} disabled={!alive || points <= 10 || isPending}><Zap className="ico" /> Cash Out</Button>
          </div>
        </Card>

        <Card>
          <div className="score-head">
            Score{" "}
            {!alive && level > 0 && points === 0 && (
              <span className="dead"><Skull className="ico" /> BANG — you died</span>
            )}
          </div>
          <div className="score-val">{points.toLocaleString()}</div>
          <p className="desc">
            Survive each spin to multiply your score ×10. You can cash out any time after 10 → 100.
          </p>
          <ul className="rules">
            <li>Chambers: 6</li>
            <li>Bullets = min(level, 5)</li>
            <li>Die if roll &lt; bullets</li>
          </ul>
        </Card>
      </div>

      <footer className="foot">
        Contract: <code>{CONTRACT_ADDRESS}</code> · Chain ID 10143 (Monad Testnet)
      </footer>

      {/* Big death overlay */}
      {isDead && (
        <motion.div
          className="death-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="death-banner"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            BANG! YOU DIED
          </motion.div>

          <div className="death-sub">Your score has been reset to 0</div>

          <div className="death-actions">
            <Button onClick={start}><RotateCw className="ico" /> Restart</Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Page() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <GameScreen />
      </WagmiProvider>
    </QueryClientProvider>
  );
}
