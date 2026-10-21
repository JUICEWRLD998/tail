# Live-platform integration: a worked example

Concrete detail behind the "Integrating against a live platform" section of SKILL.md. Kept
because the failure modes recur across platforms; the specific names are the evidence, not the
lesson. All of it was verified against the platform's own source or a live call, with the
citations recorded so a later session can re-check rather than re-guess.

---

## 1. A capability claim that verification falsified

**The claim (from the build plan):** a "Transfer trigger" watches an address for an incoming
payment, with an optional memo filter, and is therefore the node that attributes an inbound
payment without a human. The plan called it "the single most important node for this project" and
built its first workflow on it.

**What the platform source actually said:**

- `lib/mcp/workflow-schema-constants.ts`, entry `TRIGGERS.Transfer` — *"Fires when a TIP-20
  TransferWithMemo payment lands on a watched Tempo address"*, with `network` required as
  `'Tempo chain ID ("4217" mainnet, "42431" Moderato)'`.
- `components/workflow/config/trigger-config.tsx:398` — `allowedChainIds: ["4217", "42431"]`.
- `lib/workflow/store.ts:20` — `TEMPO_PAYMENT = "Transfer", // keeperhub custom field`.

So it is a chain-specific custom trigger, not a generic EVM ERC-20 watcher, and it cannot watch
the chain the integration settled on (Sepolia). The settlement side did not support that chain
either, so the memo-filtered trigger was unreachable for this integration entirely.

**The generic alternative, and its cost:** an **Event** trigger (`network`, `contractAddress`,
`contractABI` (auto-fetched if the contract is verified), `eventName`) fires on *every* transfer
of the watched token contract, with **no argument or memo filter** — so filtering by recipient
happens downstream in a Condition and every unrelated transfer costs a run against the org's
execution quota.

**Lesson:** read the trigger/action schema constants and the UI's `allowedChainIds`/required
fields before designing around a node. One grep either confirms the design or saves it.

## 2. Two claims from the same doc that were both wrong

| Claim | Reality |
| ----- | ------- |
| "Created programmatically via `POST {auth}/v1/client-ids`" | Every route on that host is authenticated by a **`session_token` cookie**. The stored spec declared **no** security schemes and attached a `Cookie` parameter to all 24 routes; a live call with the documented `x-client-id` header returned `401 Unauthorized`. Server-to-server registration is therefore impossible for that host — it needs a dashboard session. |
| "The signing secret is returned **once**" | True of the *create response* only. `GET /v1/webhook` re-lists every webhook **with its `secret`** for an authenticated session, so a lost secret is recoverable rather than fatal. |

Also worth knowing: under session auth the create body needs the id **in the body**
(`{ url, clientId }`, spec-marked "required when using session auth"), not in a header.

**Lesson:** the client should fail loudly with the real cause. The old code sent a header that
was certain to 401, and a 401 reads like a bad credential — so the next reader hunts the wrong
thing. Make it throw locally with the actual reason, and test both branches.

## 3. Demo figures that could not be paid on any write path

**Platform limits, from source:**

- `lib/execute/spend-cap-defaults.ts:73` — `DEFAULT_STABLECOIN_CAP_MICRO_USD = "100000000"`
  → **100 USD per single outflow**.
- `:88` — `DEFAULT_BATCH_STABLECOIN_CAP_MICRO_USD = "2000000000"` → **2,000 USD per
  transaction total**, with `stablecoin-cap.ts:418` bounding **each call inside a batch** at the
  same per-call figure ("Summing alone would let one large recipient hide under a generous batch
  total"). Batching does not escape the per-recipient ceiling.
- Native value capped separately and far lower (0.02 ETH/day), with no uncapped state.

**Live confirmation of the refusal** (`simulate: true`, nothing signed):

```
HTTP 400  wouldRevert: true  failureKind: "validation"
"Stablecoin transfer of 1200.00 USDC exceeds the 100.00 USD per-transaction limit"
```

**The seeded demo data was 1,200 / 860 / 2,140 per supplier against that ceiling** — every payout
would have been refused before a signature, and nothing in the build failed while that was true.
Fixed by scaling 1/100 (invoice 18.00; suppliers 6.00 / 4.30 / 7.70, summing exactly to the
invoice) and pinning the invariants in `tests/fixtures.test.ts`.

**Related trap:** omitting the token address from a transfer request is **not** an error — it
silently becomes a *native* transfer of the same nominal amount, under the far smaller native
cap. Guard every payout for a missing token address rather than letting a token payout become a
native one.

## 4. A bound destination can be the wrong network

`POST /v2/secure-payments` succeeded with the client id alone — no destination id needed — which
tempted the conclusion that the destination was fine. But reading the request back
(`GET /v2/request/{id}`) showed `"network": "mainnet"` and a payee address that was **not** the
organisation wallet the execution layer watches. The plan had chosen a testnet precisely to keep
the demo free.

**Lesson:** when a payment rail resolves the destination for you, read the resolved object back
and assert the network, the asset and the payee address explicitly. A successful create proves
none of those.

## 5. The dry-run bug that would have emptied the demo

Settlement code marked the invoice settled **before** checking whether it was a rehearsal. So a
dry run left the invoice looking paid **in the running process**; the next real settlement then
found no open invoice, classified `unmatched`, and paid nobody — on camera, with the money
untouched and no error anywhere.

Found by a test asserting *"leaves the ledger exactly as it found it"*, fixed by moving the state
write below the rehearsal return. The rehearsal script now prints the before/after of that state
and exits non-zero if it ever changed.

**Rule:** in any dry-run mode, order the code so **every** state write sits below the dry-run
return, and assert the invariant with a test rather than trusting the ordering.

## 6. Deterministic webhook replay harness

The signature covers the **raw body**, so a byte-identical redelivery is indistinguishable from
the provider's own retry. That makes the reliability beats scriptable instead of waited for:

1. build the payload, serialise it **once**, sign those exact bytes (re-serialising the parsed
   object produces different bytes and a false 401);
2. deliver it → expect the classified verdict;
3. deliver the identical bytes with the same delivery id → expect `replayed: true`, `acted: false`;
4. deliver one altered byte with the **original** signature → expect `401 digest_mismatch`.

Two things that make it trustworthy:

- **Interlock it against live spend.** Read the service's readiness output first and refuse to
  send a value-moving request unless the service is in dry-run mode or the operator passed an
  explicit `--live`.
- **Do not assert a pass the system cannot produce.** A rehearsal that persists nothing has no
  record for the redelivery to match, so it is *re*-evaluated rather than recognised as a
  replay. Assert that instead — the idempotency beat belongs to a run that writes, and saying so
  is better than a test that cannot be satisfied.
