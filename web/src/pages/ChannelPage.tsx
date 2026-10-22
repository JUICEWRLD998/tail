import { useEffect, useState } from "react";
import { dayLabel, rLabel, statusLabel, usdLabel } from "../lib/format.js";
import { fetchChannel, type ChannelPage as Data } from "../lib/pages-api.js";
import { OutcomeBar, RChart } from "../ui/charts.js";
import { CountUp } from "../ui/CountUp.js";
import { Ticket } from "../ui/Ticket.js";
import { Shell } from "./Shell.js";
import styles from "./pages.module.css";

type View = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; page: Data };

const STATUS_CLASS: Record<string, string | undefined> = { tp_hit: styles.up, sl_hit: styles.down };

export function ChannelPage({ slug }: { slug: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    void fetchChannel(slug).then((r) => {
      if (live) setView(r.ok ? { kind: "ready", page: r.page } : { kind: "error", message: r.error });
    });
    return () => { live = false; };
  }, [slug]);

  if (view.kind === "loading") {
    return <Shell title="Loading the record" documentTitle="Record"><p className={styles.note}>Reading the record.</p></Shell>;
  }
  if (view.kind === "error") {
    return (
      <Shell title="No page here" documentTitle="Not found">
        <p className={styles.error} role="alert">{view.message}</p>
        <p className={styles.note}>A caller turns their page on with /publish in a private chat with the bot.</p>
      </Shell>
    );
  }
  const { page } = view;
  const r = page.record;
  const e = page.earnings;
  const latest = page.calls[0];

  return (
    <Shell title={page.title} documentTitle={page.title}>
      <p className={styles.meta}>
        {page.kind === "group" ? "Group" : "Channel"} registered {dayLabel(page.since)}. Every number on this page is computed from stored calls and Strike fills on testnet.
      </p>

      <section className={styles.section} aria-labelledby="record">
        <h2 id="record" className={styles.kicker}>Record</h2>
        {r.calls === 0 ? (
          <p className={styles.empty}>No calls yet.</p>
        ) : (
          <>
            <dl className={styles.stats}>
              <div className={styles.stat}><dt>Calls</dt><dd><CountUp value={r.calls} /></dd></div>
              <div className={styles.stat}><dt>Hit rate</dt><dd>{r.hitRatePct === null ? "n/a" : `${r.hitRatePct}%`}</dd></div>
              <div className={styles.stat}><dt>Average result</dt><dd className={r.avgR !== null && r.avgR.startsWith("-") ? styles.down : styles.up}>{r.avgR === null ? "n/a" : rLabel(r.avgR)}</dd></div>
              <div className={styles.stat}><dt>Followers in</dt><dd><CountUp value={r.followers} /></dd></div>
            </dl>
            <div className={styles.charts}>
              <RChart rows={[...page.calls]} />
              <OutcomeBar record={r} />
            </div>
          </>
        )}
      </section>

      <section className={styles.split} aria-labelledby="latest">
        <div className={styles.section}>
          <h2 id="latest" className={styles.kicker}>Latest call</h2>
          {latest ? (
            <Ticket call={latest} label={`${statusLabel(latest.status)} · ${dayLabel(latest.createdAt)}`}
              tails={[...Array.from({ length: latest.tailed }, () => ({ mode: "tail" as const })), ...Array.from({ length: latest.faded }, () => ({ mode: "fade" as const }))]}
              showResult />
          ) : (
            <p className={styles.empty}>No calls yet.</p>
          )}
        </div>
        <div className={styles.section} aria-labelledby="earnings">
          <h2 id="earnings" className={styles.kicker}>Builder fee</h2>
          <div className={styles.earn}>
            <p className={styles.earnValue} aria-label={`Estimated builder fee ${usdLabel(e.fee)}`}>{usdLabel(e.fee)}</p>
            <p className={styles.note}>
              Estimate: entry-fill notional times the builder fee rate. {e.filled === 0
                ? "No tail has filled yet."
                : `${e.filled} filled ${e.filled === 1 ? "tail" : "tails"}, ${usdLabel(e.filledNotional)} of entry fills.`}
              {e.withoutRate > 0 && ` ${e.withoutRate} used a personal wallet and add nothing.`}
            </p>
            {page.payout.to === "caller" && (
              <p className={styles.note}>Paid by Strike straight to the account that owns the builder code <code>{page.payout.code}</code> ({page.payout.feeBps} bps).</p>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="calls">
        <h2 id="calls" className={styles.kicker}>All calls</h2>
        {page.calls.length === 0 ? (
          <p className={styles.empty}>No calls yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="visually-hidden">Calls, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Call</th><th scope="col">Entry</th><th scope="col">Target</th><th scope="col">Stop</th>
                  <th scope="col">Status</th><th scope="col" className={styles.num}>Result</th>
                  <th scope="col" className={styles.num}>Tailed / faded</th><th scope="col" className={styles.num}>Fee</th>
                </tr>
              </thead>
              <tbody>
                {page.calls.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Call">{c.symbol} <span className={c.side === "long" ? styles.up : styles.down}>{c.side.toUpperCase()}</span></td>
                    <td data-label="Entry">{c.entry ?? "market"}</td>
                    <td data-label="Target">{c.tp}</td>
                    <td data-label="Stop">{c.sl}</td>
                    <td data-label="Status"><span className={`${styles.pill} ${STATUS_CLASS[c.status] ?? ""}`}>{statusLabel(c.status)}</span></td>
                    <td data-label="Result" className={`${styles.num} ${STATUS_CLASS[c.status] ?? ""}`}>{c.resultR === null ? "n/a" : rLabel(c.resultR)}</td>
                    <td data-label="Tailed / faded" className={styles.num}>{c.tailed} / {c.faded}</td>
                    <td data-label="Fee" className={styles.num}>{usdLabel(c.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {r.calls > page.calls.length && <p className={styles.meta}>Showing the newest {page.calls.length} of {r.calls} calls. The record above counts all of them.</p>}
      </section>

      <footer className={styles.foot}>
        <a href="/">What is Tail</a>
        <span>Results use polled mark prices; a wick between two polls can be missed.</span>
      </footer>
    </Shell>
  );
}
