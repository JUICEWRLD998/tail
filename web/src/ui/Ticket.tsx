import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ladder } from "../lib/series.js";
import styles from "./Ticket.module.css";

export interface TicketCall {
  id: number;
  symbol: string;
  side: "long" | "short";
  entry: string | null;
  tp: string;
  sl: string;
  leverageHint: number | null;
  status: string;
  resultR: string | null;
}

const spring = { type: "spring" as const, stiffness: 520, damping: 30, mass: 0.7 };

function rewardRisk(c: TicketCall): string | null {
  if (c.entry === null) return null;
  const e = Number(c.entry), t = Number(c.tp), s = Number(c.sl);
  const risk = Math.abs(e - s);
  return risk === 0 ? null : (Math.abs(t - e) / risk).toFixed(2);
}

function Ladder({ call }: { call: TicketCall }) {
  const l = ladder(call);
  const H = 160, x = 30;
  const y = (v: number) => 8 + v * (H - 16);
  const top = Math.min(y(l.tp), y(l.entry)), rewardH = Math.abs(y(l.tp) - y(l.entry));
  const riskTop = Math.min(y(l.sl), y(l.entry)), riskH = Math.abs(y(l.sl) - y(l.entry));
  return (
    <svg className={styles.ladder} viewBox={`0 0 60 ${H}`} preserveAspectRatio="none" role="img"
      aria-label={`Target ${call.tp}, entry ${call.entry ?? "at market"}, stop ${call.sl}, drawn to scale`}>
      <rect className={styles.ladderReward} x={x - 12} y={top} width={24} height={rewardH} rx={3} />
      <rect className={styles.ladderRisk} x={x - 12} y={riskTop} width={24} height={riskH} rx={3} />
      <line className={styles.ladderTrack} x1={x} x2={x} y1={4} y2={H - 4} />
      <line className={`${styles.ladderTick} ${styles.ladderTp}`} x1={x - 16} x2={x + 16} y1={y(l.tp)} y2={y(l.tp)} />
      <line className={`${styles.ladderTick} ${styles.ladderEntry}`} x1={x - 16} x2={x + 16} y1={y(l.entry)} y2={y(l.entry)} strokeDasharray={l.entryKnown ? undefined : "4 4"} />
      <line className={`${styles.ladderTick} ${styles.ladderSl}`} x1={x - 16} x2={x + 16} y1={y(l.sl)} y2={y(l.sl)} />
    </svg>
  );
}

const STAMP: Record<string, { label: string; cls: string }> = {
  tp_hit: { label: "Target hit", cls: styles.stampHit as string },
  sl_hit: { label: "Stopped out", cls: styles.stampStop as string },
  expired: { label: "Expired", cls: styles.stampOther as string },
};

/**
 * A call as a printed ticket. `tails` are the follows to show (the replay reveals them one by one); `showResult` drops
 * the result stamp. Everything shown comes from the call's own rows.
 */
export function Ticket({ call, tails, showResult, label, total }: { call: TicketCall; tails: { mode: "tail" | "fade" }[]; showResult: boolean; label?: string; total?: number }) {
  const reduce = useReducedMotion();
  const tailed = tails.filter((t) => t.mode === "tail").length;
  const faded = tails.length - tailed;
  const rr = rewardRisk(call);
  const stamp = STAMP[call.status];
  const r = call.resultR === null ? null : call.resultR.startsWith("-") ? `${call.resultR}R` : `+${call.resultR}R`;

  return (
    <div className={styles.wrap}>
      <article className={styles.ticket} aria-label={`Call ${call.symbol} ${call.side}`}>
        <div className={styles.head}>
          <span>{label ?? `Call · No. ${call.id}`}</span>
          <span className={styles.headNet}>Strike testnet</span>
        </div>
        <div className={styles.title}>
          <span className={styles.symbol}>{call.symbol}</span>
          <span className={`${styles.side} ${call.side === "long" ? styles.long : styles.short}`}>
            <span className={styles.dot} aria-hidden="true" />
            {call.side.toUpperCase()}{call.leverageHint ? ` · ${call.leverageHint}x` : ""}
          </span>
        </div>
        <div className={styles.body}>
          <dl className={styles.levels}>
            <div className={styles.level}><dt>Entry</dt><dd>{call.entry ?? "market"}</dd></div>
            <div className={styles.level}><dt>Target</dt><dd>{call.tp}</dd></div>
            <div className={styles.level}><dt>Stop</dt><dd>{call.sl}</dd></div>
            {rr && <span className={styles.rr}>Reward to risk {rr}</span>}
          </dl>
          <Ladder call={call} />
        </div>
        <div className={styles.perf} aria-hidden="true" />
        <div className={styles.stub}>
          <div className={styles.counts} aria-live="polite">
            <span className={styles.count}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.b key={tailed} initial={reduce ? false : { y: "-60%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "60%", opacity: 0 }} transition={spring}>
                  {tailed}
                </motion.b>
              </AnimatePresence>
              Tailed
            </span>
            <span className={styles.count}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.b key={faded} initial={reduce ? false : { y: "-60%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "60%", opacity: 0 }} transition={spring}>
                  {faded}
                </motion.b>
              </AnimatePresence>
              Faded
            </span>
          </div>
          {(total ?? tails.length) === 0 ? (
            <p className={styles.none}>No one has taken this call yet.</p>
          ) : (
            <ul className={styles.chips} aria-label="Follows, in the order they came">
              <AnimatePresence initial={false}>
                {tails.map((t, i) => (
                  <motion.li key={i} className={`${styles.chip} ${t.mode === "tail" ? styles.chipTail : styles.chipFade}`}
                    initial={reduce ? false : { opacity: 0, scale: 0.6, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={spring}>
                    {t.mode === "tail" ? "Tail" : "Fade"}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
        <AnimatePresence>
          {showResult && stamp && (
            <motion.div className={`${styles.stamp} ${stamp.cls}`}
              initial={reduce ? false : { opacity: 0, scale: 1.8, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: -8 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}>
              {stamp.label}
              {r && <small>{r}</small>}
            </motion.div>
          )}
        </AnimatePresence>
      </article>
    </div>
  );
}
