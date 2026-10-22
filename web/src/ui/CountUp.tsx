import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** A whole number that counts up once when it scrolls into view. The final value is always the real one. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce || !inView) {
      if (reduce) setShown(value);
      return;
    }
    const c = animate(0, value, { duration: Math.min(1.2, 0.3 + value * 0.05), ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [inView, reduce, value]);
  return <span ref={ref}>{shown}</span>;
}
