import { useEffect, useState } from "react";
import { fetchSite, type SitePage } from "../lib/pages-api.js";
import { Shell } from "./Shell.js";
import styles from "./pages.module.css";

export function HomePage() {
  const [site, setSite] = useState<SitePage | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void fetchSite().then((r) => {
      if (live && r.ok) setSite(r.page);
    });
    return () => { live = false; };
  }, []);

  return (
    <Shell title="Tail the call." documentTitle="Tail the call">
      <p className={styles.lead}>
        A caller posts a trade call in a Telegram channel. Tail turns it into a card. One tap places a Strike bracket order sized to the
        follower's own risk.
      </p>
      {site?.bot && <a className={styles.cta} href={`https://t.me/${site.bot}`} rel="noreferrer">Open the bot in Telegram</a>}

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className={styles.steps}>
          <li><strong>A caller posts.</strong><span className={styles.note}>Entry, take profit, stop. A call the parser cannot read becomes a question, never a guess.</span></li>
          <li><strong>A follower taps Tail or Fade.</strong><span className={styles.note}>Size comes from their own equity and risk limit. Fade takes the other side with the levels swapped.</span></li>
          <li><strong>Strike holds the order.</strong><span className={styles.note}>Entry, take profit and stop go in as one bracket. The card and the result come from Strike's real status.</span></li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="callers">
        <h2 id="callers">For callers</h2>
        <p className={styles.note}>
          Add the bot to your channel as an admin and send /addchannel to it. /record shows your calls, /earnings shows the estimated
          builder fee on your followers' fills, and /publish turns on a public record page for your channel.
        </p>
        <p className={`${styles.note} ${styles.warn}`}>The builder fee is an estimate from entry fills. Payout to callers is not live.</p>
      </section>

      <section className={styles.section} aria-labelledby="measured">
        <h2 id="measured">Measured on this server</h2>
        {site === undefined ? (
          <p className={styles.note}>Reading the totals.</p>
        ) : (
          <>
            <dl className={styles.stats}>
              <div className={styles.stat}><dt>Channels</dt><dd>{site.channels}</dd></div>
              <div className={styles.stat}><dt>Calls</dt><dd>{site.calls}</dd></div>
              <div className={styles.stat}><dt>Filled tails</dt><dd>{site.tailsFilled}</dd></div>
            </dl>
            <p className={styles.note}>{site.note}</p>
          </>
        )}
      </section>

      <footer className={styles.foot}>
        <span>Built for the Strike Hackathon by Mustapha Fadhlullah, independent security researcher.</span>
        <span>Testnet only.</span>
      </footer>
    </Shell>
  );
}
