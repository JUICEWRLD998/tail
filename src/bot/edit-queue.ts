// Telegram throttles message edits per chat, so card counter updates are batched: the first edit for a card goes out
// at once, anything arriving inside the window is coalesced into one trailing edit carrying the latest text. A final
// edit (a call's result) goes out immediately, cancels whatever is pending and blocks later edits to that card, so a
// stale counter can never overwrite the result.
export interface CardEdit {
  chatId: number;
  messageId: number;
  text: string;
  buttons: { text: string; url: string }[];
}

export interface EditQueueOptions {
  delayMs: number;
  edit: (chatId: number, messageId: number, text: string, buttons: CardEdit["buttons"]) => Promise<void>;
  log?: (message: string) => void;
}

interface Slot {
  lastSentAt: number | undefined;
  pending: CardEdit | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  done: boolean;
}

export function createEditQueue(o: EditQueueOptions) {
  const slots = new Map<string, Slot>();
  const key = (e: Pick<CardEdit, "chatId" | "messageId">) => `${e.chatId}:${e.messageId}`;

  async function send(slot: Slot, e: CardEdit) {
    slot.lastSentAt = Date.now();
    try {
      await o.edit(e.chatId, e.messageId, e.text, e.buttons);
    } catch (err) {
      o.log?.(`card edit ${key(e)} failed: ${(err as Error).message}`);
    }
  }

  return {
    async enqueue(e: CardEdit, opts: { final?: boolean } = {}): Promise<void> {
      const k = key(e);
      const slot = slots.get(k) ?? { lastSentAt: undefined, pending: undefined, timer: undefined, done: false };
      slots.set(k, slot);
      if (slot.done) return; // the card already shows its result
      if (opts.final) {
        slot.done = true;
        slot.pending = undefined;
        if (slot.timer) clearTimeout(slot.timer);
        slot.timer = undefined;
        return send(slot, e);
      }
      const due = slot.lastSentAt === undefined || o.delayMs <= 0 || Date.now() - slot.lastSentAt >= o.delayMs;
      if (due) {
        slot.pending = undefined;
        if (slot.timer) clearTimeout(slot.timer);
        slot.timer = undefined;
        return send(slot, e);
      }
      slot.pending = e;
      if (!slot.timer) {
        slot.timer = setTimeout(() => {
          slot.timer = undefined;
          const p = slot.pending;
          slot.pending = undefined;
          if (p && !slot.done) void send(slot, p);
        }, o.delayMs - (Date.now() - (slot.lastSentAt as number)));
      }
    },

    /** Sends every pending edit now (used on shutdown). */
    async flush(): Promise<void> {
      for (const slot of slots.values()) {
        if (slot.timer) clearTimeout(slot.timer);
        slot.timer = undefined;
        const p = slot.pending;
        slot.pending = undefined;
        if (p && !slot.done) await send(slot, p);
      }
    },
  };
}

export type EditQueue = ReturnType<typeof createEditQueue>;
