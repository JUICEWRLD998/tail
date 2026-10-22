import { describe, expect, it } from "vitest";
import { checkBuilderCode } from "../src/strike/code-check.js";
import { StrikeError } from "../src/strike/client.js";

const client = (impl: (i: any) => Promise<any>) => ({ builderRequestSignature: impl });

describe("checkBuilderCode", () => {
  it("is ok when Strike issues a challenge for the code", async () => {
    let sent: any;
    expect(await checkBuilderCode(client(async (i) => ((sent = i), { nonce: "n", message_to_sign: "m" })), "alpha", 25)).toBe("ok");
    expect(sent).toMatchObject({ chain: "solana", code: "alpha", feeShareBps: 25 });
    expect(sent.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("uses a fresh throwaway address and key each time: nothing about the caller is sent", async () => {
    const seen: any[] = [];
    const c = client(async (i) => (seen.push(i), { nonce: "n", message_to_sign: "m" }));
    await checkBuilderCode(c, "alpha", 10);
    await checkBuilderCode(c, "alpha", 10);
    expect(seen[0].address).not.toBe(seen[1].address);
    expect(seen[0].publicKey).not.toBe(seen[1].publicKey);
  });

  it("is unknown on Strike's 404 'builder code not found' (VERIFIED live)", async () => {
    expect(await checkBuilderCode(client(async () => { throw new StrikeError(404, "POST", "/auth/builder/request-signature", "builder code not found"); }), "x", 10)).toBe("unknown");
  });

  it("is unreachable on any other error, so a Strike outage never stores or refuses a code by mistake", async () => {
    expect(await checkBuilderCode(client(async () => { throw new StrikeError(500, "POST", "/p", "boom"); }), "x", 10)).toBe("unreachable");
    expect(await checkBuilderCode(client(async () => { throw new Error("network"); }), "x", 10)).toBe("unreachable");
  });
});
