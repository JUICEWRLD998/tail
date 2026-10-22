import { Shell } from "./Shell.js";
import styles from "./pages.module.css";

export function NotFoundPage() {
  return (
    <Shell title="No page here" documentTitle="Not found">
      <p className={styles.note}>This address does not match a Tail page.</p>
      <a className={styles.cta} href="/">Go to the start</a>
    </Shell>
  );
}
