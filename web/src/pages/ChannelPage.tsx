import { useEffect, useState } from "react";
import { dayLabel, rLabel, statusLabel, usdLabel } from "../lib/format.js";
import { fetchChannel, type ChannelPage as Data } from "../lib/pages-api.js";
import { Shell } from "./Shell.js";
import styles from "./pages.module.css";

type View = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; page: Data };

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
  return (
    <Shell title={page.title} documentTitle={page.title}>
      <p className={styles.meta}>Registered {dayLabel(page.since)}. Every number is computed from stored calls and fills on Strike testnet.</p>

      <section className={styles.section} aria-labelledby="record">
        <h2 id="record">Record</h2>
        {r.calls === 0 ? (
          <p className={styles.empty}>No calls yet.</p>
        ) : (
          <dl className={styles.stats}>
            <div className={styles.stat}><dt>Calls</dt><dd>{r.calls}</dd></div>
            <div className={styles.stat}><dt>Open</dt><dd>{r.open}</dd></div>
            <div className={styles.stat}><dt>Target / stop</dt><dd>{r.tpHit} / {r.slHit}</dd></div>
            <div className={styles.stat}><dt>Hit rate</dt><dd>{r.hitRatePct === null ? "No result yet" : `${r.hitRatePct}%`}</dd></div>
            <div className={styles.stat}><dt>Average result</dt><dd>{r.avgR === null ? "No result yet" : rLabel(r.avgR)}</dd></div>
            <div className={styles.stat}><dt>Followers in</dt><dd>{r.followers}</dd></div>
          </dl>
        )}
      </section>

      <section className={styles.section} aria-labelledby="earnings">
        <h2 id="earnings">Builder fee</h2>
        <div className={styles.earn}>
          <p className={styles.earnValue} aria-label={`Estimated builder fee ${usdLabel(e.fee)}`}>{usdLabel(e.fee)}</p>
          <p className={styles.note}>
            Estimate: entry-fill notional times the builder fee rate. {e.filled === 0
              ? "No tail has filled yet."
              : `${e.filled} filled ${e.filled === 1 ? "tail" : "tails"}, ${usdLabel(e.filledNotional)} of entry fills.`}
            {e.withoutRate > 0 && ` ${e.withoutRate} used a personal wallet and add nothing.`}
          </p>
          <p className={`${styles.note} ${styles.warn}`}>Strike's fill record has no builder-share field, and exit fills are not counted. Payout to callers is not live.</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="calls">
        <h2 id="calls">Calls</h2>
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
                  <th scope="col" className={styles.num}>Followers</th><th scope="col" className={styles.num}>Fee</th>
                </tr>
              </thead>
              <tbody>
                {page.calls.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Call">{c.symbol} {c.side.toUpperCase()}</td>
                    <td data-label="Entry">{c.entry ?? "Market"}</td>
                    <td data-label="Target">{c.tp}</td>
                    <td data-label="Stop">{c.sl}</td>
                    <td data-label="Status">{statusLabel(c.status)}</td>
                    <td data-label="Result" className={`${styles.num} ${c.status === "tp_hit" ? styles.up : c.status === "sl_hit" ? styles.down : ""}`}>{c.resultR === null ? "n/a" : rLabel(c.resultR)}</td>
                    <td data-label="Followers" className={styles.num}>{c.followers}</td>
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
