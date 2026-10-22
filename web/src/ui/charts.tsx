import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { cumulativeR, outcomeSegments, type OutcomeKey, type RRow } from "../lib/series.js";
import styles from "./charts.module.css";

const signed = (r: number) => `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2).replace(/\.?0+$/, "") || "0"}R`;

/** Running result in R, one step per decided call. The line draws itself in when it scrolls into view. */
export function RChart({ rows }: { rows: RRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const pts = cumulativeR(rows);
  const last = pts.at(-1)?.r ?? 0;

  const W = 600, H = 200, padL = 40, padR = 16, padT = 14, padB = 26;
  const rs = pts.map((p) => p.r);
  const hi = Math.max(1, ...rs), lo = Math.min(-1, ...rs);
  const n = Math.max(1, pts.length - 1);
  const x = (i: number) => padL + (i / n) * (W - padL - padR);
  const y = (r: number) => padT + ((hi - r) / (hi - lo)) * (H - padT - padB);
  // A step line: each call's result is a jump, not a slope between calls.
  const d = pts.map((p, k) => (k === 0 ? `M${x(p.i)},${y(p.r)}` : `H${x(p.i)}V${y(p.r)}`)).join("");
  const area = `${d}V${y(0)}H${x(0)}Z`;
  const down = last < 0;
  const show = inView || reduce;

  return (
    <div className={styles.chart} ref={ref}>
      <div className={styles.head}>
        <span className={styles.title}>Running result</span>
        <span className={`${styles.figure} ${down ? styles.down : styles.up}`}>{signed(last)}</span>
      </div>
      {pts.length < 2 ? (
        <p className={styles.empty}>No call has reached its target or stop yet, so there is no line to draw.</p>
      ) : (
        <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Running result over ${pts.length - 1} decided calls, ending at ${signed(last)}`}>
          {[hi, 0, lo].map((v) => (
            <g key={v}>
              <line className={v === 0 ? styles.zero : styles.grid} x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />
              <text className={styles.axis} x={padL - 8} y={y(v) + 4} textAnchor="end">{signed(v)}</text>
            </g>
          ))}
          <text className={styles.axis} x={x(0)} y={H - 6}>start</text>
          <text className={styles.axis} x={x(n)} y={H - 6} textAnchor="end">call {pts.length - 1}</text>
          {!down && <motion.path className={styles.area} d={area} initial={{ opacity: 0 }} animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.6, delay: reduce ? 0 : 0.5 }} />}
          <motion.path className={`${styles.line} ${down ? styles.lineDown : ""}`} d={d}
            initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: show ? 1 : 0 }} transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }} />
          {pts.slice(1).map((p, k) => (
            <motion.circle key={p.i} className={`${styles.dot} ${p.r >= (pts[k]?.r ?? 0) ? styles.dotUp : styles.dotDown}`} cx={x(p.i)} cy={y(p.r)} r={4.5}
              initial={{ scale: reduce ? 1 : 0 }} animate={{ scale: show ? 1 : 0 }} transition={{ delay: reduce ? 0 : 0.2 + (k / n) * 0.9, type: "spring", stiffness: 500, damping: 22 }} />
          ))}
        </svg>
      )}
    </div>
  );
}

const SEG_LABEL: Record<OutcomeKey, string> = { tp: "Target", sl: "Stop", open: "Open", expired: "Expired" };

/** Where the calls ended up, as one bar. Segments grow in from the left. */
export function OutcomeBar({ record }: { record: { tpHit: number; slHit: number; open: number; expired: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const segs = outcomeSegments(record);
  return (
    <div className={styles.chart} ref={ref}>
      <div className={styles.head}>
        <span className={styles.title}>Where calls ended</span>
      </div>
      {segs.length === 0 ? (
        <p className={styles.empty}>No calls yet.</p>
      ) : (
        <>
          <div className={styles.bar} role="img" aria-label={segs.map((s) => `${SEG_LABEL[s.key]} ${s.count}`).join(", ")}>
            {segs.filter((s) => s.count > 0).map((s, k) => (
              <motion.span key={s.key} className={`${styles.seg} ${styles[s.key]}`}
                initial={{ flexBasis: reduce ? `${s.share * 100}%` : "0%" }} animate={{ flexBasis: inView || reduce ? `${s.share * 100}%` : "0%" }}
                transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : k * 0.08, ease: [0.22, 1, 0.36, 1] }} style={{ flexGrow: 0, flexShrink: 0 }} />
            ))}
          </div>
          <ul className={styles.legend}>
            {segs.map((s) => (
              <li key={s.key}><span className={`${styles.swatch} ${styles[s.key]}`} aria-hidden="true" />{SEG_LABEL[s.key]} <b>{s.count}</b></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
