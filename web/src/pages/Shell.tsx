import { useEffect, useRef, type ReactNode } from "react";
import styles from "./pages.module.css";

/** Common frame: brand, testnet tag, optional page title that takes focus so a screen reader announces the page. */
export function Shell({ title, documentTitle, bot, children }: { title?: string; documentTitle: string; bot?: string | null; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${documentTitle} · Tail`;
  }, [documentTitle]);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="Tail">
          <a className={styles.brand} href="/"><span className={styles.mark} aria-hidden="true" />Tail</a>
          <div className={styles.navRight}>
            <span className={styles.tag}>Strike testnet</span>
            {bot && <a className={styles.navLink} href={`https://t.me/${bot}`} rel="noreferrer">Open the bot</a>}
          </div>
        </nav>
        {title !== undefined && (
          <header className={styles.head}>
            <h1 className={styles.title} ref={heading} tabIndex={-1}>{title}</h1>
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
