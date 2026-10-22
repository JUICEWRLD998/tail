import { useEffect, useRef, type ReactNode } from "react";
import styles from "./pages.module.css";

/** Common frame: brand, testnet tag, and a heading that takes focus so a screen reader announces each page. */
export function Shell({ title, documentTitle, children }: { title: string; documentTitle: string; children: ReactNode }) {
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
          <a className={styles.brand} href="/">Tail</a>
          <span className={styles.tag}>Strike testnet</span>
        </nav>
        <header className={styles.head}>
          <h1 className={styles.title} ref={heading} tabIndex={-1}>{title}</h1>
        </header>
        {children}
      </div>
    </div>
  );
}
