import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { fetchSite, type FeaturedCall, type SitePage } from "../lib/pages-api.js";
import { CountUp } from "../ui/CountUp.js";
import { Ticket } from "../ui/Ticket.js";
import { Shell } from "./Shell.js";
import styles from "./pages.module.css";
import { useReplay } from "./useReplay.js";

const rise = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Replay({ call }: { call: FeaturedCall }) {
  const { ref, shown, stamped, playing, replay } = useReplay(call);
  const tailed = call.tails.filter((t) => t.mode === "tail").length;
  const faded = call.tails.length - tailed;
  return (
    <div className={styles.heroCard} ref={ref}>
      <Ticket call={call} tails={call.tails.slice(0, shown)} total={call.tails.length} showResult={stamped} />
      <p className={styles.caption}>
        Replayed from a real call on Strike testnet: {plural(tailed, "tail")}, {plural(faded, "fade")}, in the order they came. Timing compressed.
      </p>
      {call.tails.length > 0 && (
        <button type="button" className={styles.ghost} onClick={replay} disabled={playing}>{playing ? "Replaying" : "Replay"}</button>
      )}
    </div>
  );
}

export function HomePage() {
  const reduce = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const [site, setSite] = useState<SitePage | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchSite().then((r) => {
      if (!live) return;
      if (r.ok) setSite(r.page);
      else setFailed(true);
    });
    return () => { live = false; };
  }, []);
  useEffect(() => { heading.current?.focus(); }, []);

  const f = site?.featured ?? null;
  const t = (d: number) => ({ ...rise, transition: { duration: reduce ? 0 : 0.5, delay: reduce ? 0 : d, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <Shell documentTitle="Tail the call" bot={site?.bot ?? null}>
      <section className={styles.hero} aria-labelledby="hero">
        <div className={styles.heroText}>
          <motion.p className={styles.eyebrow} {...t(0)}>Telegram calls · Strike brackets</motion.p>
          <motion.h1 id="hero" className={styles.display} ref={heading} tabIndex={-1} {...t(0.05)}><strong>Tail</strong> the call.<br /><em>Or fade it.</em></motion.h1>
          <motion.p className={styles.lead} {...t(0.12)}>
            A caller posts a trade in their channel. Tail turns it into a ticket. One tap places the entry, take profit and stop on Strike, sized to your own risk.
          </motion.p>
          <motion.div className={styles.ctas} {...t(0.18)}>
            {site?.bot && <a className={styles.cta} href={`https://t.me/${site.bot}`} rel="noreferrer">Open the bot in Telegram</a>}
            <a className={styles.ghost} href="#how">How it works</a>
          </motion.div>
        </div>
        {site === undefined ? (
          <p className={styles.caption}>{failed ? "Could not load the latest call." : "Loading the latest call."}</p>
        ) : f ? (
          <Replay call={f} />
        ) : (
          <p className={styles.empty}>No call has been posted on this server yet. The first one will show here.</p>
        )}
      </section>

      <section id="how" className={styles.section} aria-labelledby="how-title">
        <div className={styles.sectionHead}>
          <span className={styles.kicker}>Three taps</span>
          <h2 id="how-title">From a message to a bracket order</h2>
        </div>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNo}>01</span>
            <h3>The caller posts</h3>
            {f && <p className={styles.bubble} aria-label="A call, written the way callers write them">{`${f.symbol} ${f.side.toUpperCase()}${f.entry ? ` ${f.entry}` : " NOW"}\nTP ${f.tp}\nSL ${f.sl}${f.leverageHint ? `\n${f.leverageHint}x` : ""}`}</p>}
            <p className={styles.note}>Any common format. If the parser is unsure, it asks the caller one question instead of guessing.</p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNo}>02</span>
            <h3>You tap Tail or Fade</h3>
            <div className={styles.buttons} aria-hidden="true">
              <span className={`${styles.tgButton} ${styles.tgTail}`}>Tail</span>
              <span className={`${styles.tgButton} ${styles.tgFade}`}>Fade</span>
            </div>
            <p className={styles.note}>Size comes from your equity and your risk limit. Fade takes the other side with the target and stop swapped.</p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNo}>03</span>
            <h3>Strike holds the bracket</h3>
            {f && (
              <div className={styles.bracket} aria-label="The three orders Strike holds">
                <span className={styles.bTp}><b>Take profit</b>{f.tp}</span>
                <span><b>Entry</b>{f.entry ?? "market"}</span>
                <span className={styles.bSl}><b>Stop</b>{f.sl}</span>
              </div>
            )}
            <p className={styles.note}>All three go in as one order. The card and the result come from Strike's real order status.</p>
          </li>
        </ol>
      </section>

      <section className={styles.split} aria-labelledby="callers">
        <div className={styles.sectionHead}>
          <span className={styles.kicker}>For callers</span>
          <h2 id="callers">Your record keeps itself</h2>
          <p className={styles.note}>
            Add the bot to your channel as an admin and send it /addchannel. Every call gets a result from the market, not from you.
            /record shows your hit rate, /earnings the builder fee on your followers' fills, and /publish turns on a public page.
          </p>
          <p className={`${styles.note} ${styles.warn}`}>The builder fee is an estimate from entry fills. Payout to callers is not live.</p>
        </div>
        <div className={styles.section} aria-labelledby="measured">
          <h3 id="measured" className={styles.kicker}>Measured on this server</h3>
          {site ? (
            <>
              <dl className={styles.stats}>
                <div className={styles.stat}><dt>Channels</dt><dd><CountUp value={site.channels} /></dd></div>
                <div className={styles.stat}><dt>Calls</dt><dd><CountUp value={site.calls} /></dd></div>
                <div className={styles.stat}><dt>Filled tails</dt><dd><CountUp value={site.tailsFilled} /></dd></div>
              </dl>
              <p className={styles.note}>{site.note}</p>
            </>
          ) : (
            <p className={styles.note}>{failed ? "Could not load the totals." : "Reading the totals."}</p>
          )}
        </div>
      </section>

      <footer className={styles.foot}>
        <span>Built for the Strike Hackathon by Mustapha Fadhlullah, independent security researcher.</span>
        <span>Testnet only.</span>
      </footer>
    </Shell>
  );
}
