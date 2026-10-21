import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createApi, type Info } from "../lib/api.js";
import { detectWallets, type WalletOption } from "../wallets/index.js";
import { runConnect, type Step } from "./flow.js";
import styles from "./ConnectPage.module.css";
import { takeToken } from "./token.js";

type View =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "ready" }
  | { kind: "working"; step: Step }
  | { kind: "done"; address: string }
  | { kind: "error"; message: string };

const STEPS: { id: Step; label: string }[] = [
  { id: "connecting", label: "Open your wallet" },
  { id: "signing", label: "Sign the message" },
  { id: "linking", label: "Link with Strike" },
];

const NETWORK_LABEL = { ethereum: "Ethereum", solana: "Solana", cardano: "Cardano" } as const;

const percent = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

export function ConnectPage() {
  const api = useRef(createApi()).current;
  const token = useRef<string | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>({ kind: "loading" });
  // The builder info outlives the ready state, so the fee line stays correct after an error or a success.
  const [info, setInfo] = useState<Extract<Info, { ok: true }> | undefined>(undefined);
  const [wallets, setWallets] = useState<WalletOption[]>([]);

  // Read the token once, then ask the server whether it is still good.
  useEffect(() => {
    token.current = takeToken(window.location, window.history, window.sessionStorage);
    if (!token.current) {
      setView({ kind: "invalid", message: "This link is missing its code. Send /connect to the bot in Telegram for a new one." });
      return;
    }
    void api.info(token.current).then((r) => {
      if (r.ok) setInfo(r);
      setView(r.ok ? { kind: "ready" } : { kind: "invalid", message: r.error });
    });
  }, [api]);

  // Wallet extensions inject late; look again shortly after load.
  useEffect(() => {
    const look = () => setWallets(detectWallets(window as never));
    look();
    const timers = [300, 1000, 2000].map((ms) => window.setTimeout(look, ms));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  // Move focus to the heading when the view changes so screen readers announce the new state.
  useEffect(() => {
    heading.current?.focus();
  }, [view.kind]);

  async function start(walletId: string) {
    if (!token.current) return;
    const r = await runConnect({ api, win: window as never, token: token.current, walletId, onStep: (step) => setView({ kind: "working", step }) });
    setView(r.ok ? { kind: "done", address: r.address } : { kind: "error", message: r.error });
  }

  const fee = info ? percent(info.feeCapBps) : "a small fee";
  const move = reduce ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.brand}>Tail</div>

        <header className={styles.head}>
          <h1 className={styles.title} ref={heading} tabIndex={-1}>
            {view.kind === "done" ? "Wallet connected" : "Connect your wallet"}
          </h1>
          <p className={styles.lead}>
            {view.kind === "done" ? "Tail can now place orders on Strike for you." : "Sign one message so Tail can place orders on Strike for you."}
          </p>
        </header>

        <section className={styles.facts} aria-label="What you are approving">
          <div className={styles.factGroup}>
            <h2>What you approve</h2>
            <ul>
              <li>Tail can place and cancel orders on your Strike account.</li>
              <li>Tail adds a fee of up to {fee} of each trade, on top of Strike's own fees.</li>
            </ul>
          </div>
          <div className={styles.factGroup}>
            <h2>What Tail cannot do</h2>
            <ul>
              <li>Withdraw your funds. Strike needs your own wallet signature for every withdrawal.</li>
              <li>Trade without you. Each trade asks you to confirm in Telegram.</li>
              <li>Keep access after you ask it to stop. Send /revoke in Telegram to remove the key from Tail.</li>
            </ul>
          </div>
        </section>

        <section className={styles.panel} aria-label="Connect" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view.kind === "working" ? "working" : view.kind} className={styles.inner} {...move} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
              {view.kind === "loading" && <p className={styles.status}>Checking your link.</p>}

              {view.kind === "invalid" && (
                <>
                  <h2 className={styles.panelTitle}>This link cannot be used</h2>
                  <p className={styles.error}>{view.message}</p>
                </>
              )}

              {(view.kind === "ready" || view.kind === "error") && (
                <>
                  <h2 className={styles.panelTitle}>Choose a wallet</h2>
                  {view.kind === "error" && <p className={styles.error} role="alert">{view.message}</p>}
                  {wallets.length === 0 ? (
                    <p className={styles.notice}>
                      No wallet found in this browser. Open this link in the browser built into MetaMask, Rabby, Phantom, Lace or Eternl, or install one on desktop.
                    </p>
                  ) : (
                    <ul className={styles.wallets}>
                      {wallets.map((w) => (
                        <li key={w.id}>
                          <button type="button" className={styles.wallet} onClick={() => void start(w.id)}>
                            <span>{view.kind === "error" ? `Try ${w.label} again` : `Use ${w.label}`}</span>
                            <span className={styles.network}>{NETWORK_LABEL[w.chain]}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {view.kind === "working" && (
                <>
                  <h2 className={styles.panelTitle}>Approve in your wallet</h2>
                  <ol className={styles.steps}>
                    {STEPS.map((s, i) => {
                      const at = STEPS.findIndex((x) => x.id === view.step);
                      const state = i < at ? styles.stepDone : i === at ? styles.stepActive : "";
                      return (
                        <li key={s.id} className={`${styles.step} ${state}`} aria-current={i === at ? "step" : undefined}>
                          <span className={styles.mark} aria-hidden="true">{i < at ? "✓" : i + 1}</span>
                          <span>{s.label}</span>
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}

              {view.kind === "done" && (
                <>
                  <h2 className={styles.panelTitle}>Linked</h2>
                  <p className={styles.address}>{view.address}</p>
                  <p className={styles.status}>Go back to Telegram and tap Tail on a call card. You can close this tab.</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
