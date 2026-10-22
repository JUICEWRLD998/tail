// A tiny in-process scheduler. A task never overlaps itself, a failing task keeps its schedule, and stop() lets
// anything already running finish. There is no catch-up: a missed tick is simply skipped.
export interface Task {
  name: string;
  everyMs: number;
  run: () => Promise<unknown>;
}

export function createScheduler(tasks: Task[], log: (message: string) => void = () => {}) {
  for (const t of tasks) if (!(t.everyMs > 0)) throw new Error(`task ${t.name}: everyMs must be positive`);
  let timers: ReturnType<typeof setInterval>[] = [];
  const running = new Map<string, Promise<void>>();

  const tick = (t: Task) => {
    if (running.has(t.name)) return; // still busy: skip this tick
    const p = (async () => {
      try {
        await t.run();
      } catch (e) {
        log(`task ${t.name} failed: ${(e as Error).message}`);
      } finally {
        running.delete(t.name);
      }
    })();
    running.set(t.name, p);
  };

  return {
    start() {
      if (timers.length > 0) return;
      timers = tasks.map((t) => setInterval(() => tick(t), t.everyMs));
    },
    async stop() {
      timers.forEach(clearInterval);
      timers = [];
      await Promise.all([...running.values()]);
    },
  };
}

export type Scheduler = ReturnType<typeof createScheduler>;
