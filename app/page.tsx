"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Skull, Target, RotateCw, Zap, X } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import AuthComponent from "@/components/Auth";

const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0x336cc67C7A141d6d1711830EaDDC2147d3a33191" as const);

// 👉 ссылка на лидерборд MGID
const LEADERBOARD_URL =
  "https://monad-games-id-site.vercel.app/leaderboard?page=1&gameId=240&sortBy=scores";

// ── helpers ───────────────────────────────────────────────────────────────────
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

function randBullets(count: number): number[] {
  const set = new Set<number>();
  while (set.size < count) set.add(Math.floor(Math.random() * 6));
  return Array.from(set).sort((a, b) => a - b);
}

// ── Revolver ──────────────────────────────────────────────────────────────────
function Revolver({
  bulletPositions,
  lastRoll,
  spinning,
}: {
  bulletPositions: number[];
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
        {Array.from({ length: chambers }).map((_, i) => {
          const angle = (i / chambers) * Math.PI * 2;
          const cx = 100 + Math.cos(angle) * 55;
          const cy = 100 + Math.sin(angle) * 55;
          const isBullet = bulletPositions.includes(i);
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

// ── Game ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const { ready, authenticated } = usePrivy();

  const [mgidAddr, setMgidAddr] = useState<string>("");
  const [level, setLevel] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [alive, setAlive] = useState<boolean>(false);

  const [bulletPositions, setBulletPositions] = useState<number[]>([]);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [pending, setPending] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalScore, setModalScore] = useState<number>(0);
  const [modalTx, setModalTx] = useState<string | null>(null);

  const handleUserChange = (u: any) => setMgidAddr(u?.address || "");
  const riskText = useMemo(() => `${bulletPositions.length}/6`, [bulletPositions]);

  const start = async () => {
    if (!ready || !authenticated) {
      alert("Sign in with Monad Games ID first.");
      return;
    }
    setLastRoll(null);
    setLevel(1);
    setPoints(10);
    setAlive(true);
    setBulletPositions(randBullets(1));
  };

  const spin = async () => {
    if (!alive) return;
    setSpinning(true);

    const roll = Math.floor(Math.random() * 6);

    setTimeout(() => {
      setSpinning(false);
      setLastRoll(roll);

      const dead = bulletPositions.includes(roll);
      if (dead) {
        setAlive(false);
        setPoints(0);
        return;
      }

      setPoints((p) => p * 10);
      setLevel((l) => {
        const nextLevel = l + 1;
        const nextCount = Math.min(nextLevel, 5);
        setBulletPositions(randBullets(nextCount));
        return nextLevel;
      });
    }, 820);
  };

  const cashOut = async () => {
    if (!alive || points <= 10) return;
    if (!mgidAddr) {
      alert("Sign in with Monad Games ID first.");
      return;
    }

    const finalScore = points;
    setPending(true);
    try {
      const res = await fetch("/api/submit-onchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player: mgidAddr,
          score: finalScore,
          game: CONTRACT_ADDRESS,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "submit failed");

      setAlive(false);
      setModalScore(finalScore);
      setModalTx(typeof data?.tx === "string" ? data.tx : null);
      setShowModal(true);
    } catch (e: any) {
      alert(e?.message || e);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="wrap">
      <header className="top">
        <h1 className="title title-big">
          <span className="muted">Monad</span> <span className="blood">Russian Spin</span>
        </h1>
        <div className="tools">
          <AuthComponent onUserChange={handleUserChange} />
        </div>
      </header>

      <div className="grid">
        <Card>
          <div className="meta">
            <div>Risk: <b>{riskText}</b></div>
            <div>Level: <b>{level || "-"}</b></div>
          </div>
          <Revolver bulletPositions={bulletPositions} lastRoll={lastRoll} spinning={spinning} />
          <div className="actions">
            <Button onClick={start} disabled={pending}><RotateCw className="ico" /> Start</Button>
            <Button onClick={spin} disabled={!alive || pending}><Target className="ico" /> {pending ? "..." : "Spin"}</Button>
            <Button variant="warning" onClick={cashOut} disabled={!alive || points <= 10 || pending}><Zap className="ico" /> Cash Out</Button>
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

          {/* 👉 Кнопка-ссылка на глобальный лидерборд */}
          <div style={{ marginTop: 14 }}>
            <a
              href={LEADERBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ textDecoration: "none" }}
            >
              🌐 Global Leaderboard
            </a>
          </div>
        </Card>
      </div>

      <footer className="foot">
        Contract: <code>{CONTRACT_ADDRESS}</code> · Chain: Monad Testnet (10143)
      </footer>

      {/* Death overlay */}
      {!alive && level > 0 && points === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.7)",
            display: "grid",
            placeItems: "center",
            zIndex: 60,
          }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            style={{
              fontWeight: 800,
              letterSpacing: 2,
              color: "#fca5a5",
              textShadow: "0 0 22px rgba(239, 68, 68, .5)",
              fontSize: "clamp(32px, 8vw, 84px)",
            }}
          >
            YOU ARE DEAD
          </motion.div>
          <div style={{ marginTop: 12, color: "#ddd" }}>Your score has been reset to 0</div>
          <div style={{ marginTop: 18 }}>
            <Button onClick={() => start()}><RotateCw className="ico" /> Restart</Button>
          </div>
        </motion.div>
      )}

      {/* CashOut success modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 80,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{
              position: "relative",
              width: "min(92vw, 520px)",
              padding: "22px 22px 18px",
              cursor: "default",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              onClick={() => setShowModal(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "transparent",
                border: "none",
                color: "#aaa",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Score submitted!</div>
            <div style={{ opacity: 0.9, marginBottom: 14 }}>
              Your score <b>{modalScore.toLocaleString()}</b> has been sent to the{" "}
              <b>Monad Games ID</b> leaderboard.
            </div>
            {modalTx && (
              <div
                style={{
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  padding: "10px",
                  borderRadius: 8,
                  wordBreak: "break-all",
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                tx: {modalTx.slice(0, 10)}…{modalTx.slice(-8)}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <a
                href={LEADERBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ textDecoration: "none" }}
              >
                View Leaderboard
              </a>
              <Button variant="ghost" onClick={() => setShowModal(false)}>OK</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
