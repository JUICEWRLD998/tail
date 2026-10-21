# Worked audit: an agent-built payment-reconciliation service (TrueUp, 2026-09-14)

The build had a green 143-test suite, a rehearsed demo loop, an honest limitations doc and a real
on-chain transaction. The user still asked: *"seems you did a demo script in phase 2, so please
ensure that our product is a real product and not a demo product."* He was right. Three seams, one
of them capable of paying the wrong party with real money.

Read this as the concrete form of the taxonomy in SKILL.md.

## What the service does (context)

Signed payment webhook (Request Network) → Node/TS bridge verifies HMAC over raw bytes →
reconciles the settlement against a local book of invoices → pays each supplier through an
execution API (KeeperHub: dry-run with `simulate: true`, then broadcast with an idempotency key).

## Seam 1 — the lookup ignored the invoice

```ts
// BEFORE, bridge/src/ledger.ts
suppliersForInvoice(): Supplier[] {          // no argument at all
  return Object.values(this.state.suppliers);
}
// settled invoice -> every counterparty in the book gets paid
const suppliers = ledger.suppliersForInvoice();   // bridge/src/settle.ts
```

The stored row (`Supplier`) had no invoice on it, so there was no binding to filter by. With the
**one** invoice the demo used, this is indistinguishable from correct. The book actually held
three invoices: settling `INV-4473` would have paid `INV-4471`'s three suppliers as well — a
settlement that classified exactly as intended, money to the wrong party, no error anywhere.

Detection that finds this class fast:

```bash
search_files pattern='(ForInvoice|ForUser|ForOrder|ForTenant)\(' output_mode=content   # signatures
search_files pattern='suppliersForInvoice|addSupplier' output_mode=content             # callers
```

Fix (structural):

- `Payable` replaces `Supplier` as the stored row and carries a required `invoiceId`.
- `payablesForInvoice(invoiceId: string)` takes the parent id as a **required** argument and
  filters + sorts. The parent-blind call no longer compiles.
- A matched invoice with **no** payables returns verdict `held` with a reason naming the fix
  ("register the invoice's payables via POST /invoices or scripts/add-invoice.ts"), instead of a
  `matched` record with zero payouts.
- The state file is versioned (`LEDGER_STATE_VERSION = 2`). v1 rows carry no invoice, so loading
  v1 **drops** them and pushes a note; `load()` exposes `migrationNotes()` and the startup banner,
  seed script and CLI all print them. Guessing the binding was rejected explicitly.
- The fixture now puts one supplier (`SUP-CARRIER`) on **two** invoices on purpose, and the settle
  test asserts settling one pays only its own payable.

## Seam 2 — the only input path was the demo seed

Every invoice and its payables entered the ledger via `scripts/seed-demo.ts` reading
`fixtures/invoices.json`. The product had no way to take a real receivable, and every rule about
what made an invoice payable lived in a test asserting against that one file.

Fix: `src/intake.ts` became the single writer — `validateIntake()` (pure) + `registerInvoice()` —
called by **both** `POST /invoices` and `scripts/add-invoice.ts`, plus the seed script. Refusals,
all of which would otherwise fail (or silently mis-pay) at execution time:

- payable with no token address → the API treats it as a NATIVE transfer of the same nominal
  amount under a far smaller cap;
- payout above the platform's per-transaction stablecoin cap;
- payables that do not sum to the invoice (either direction — "collected and never paid out" /
  "paid out of money never collected");
- a currency whose cap we cannot state (explicit allowlist rather than hoping);
- re-registering an invoice that is already settled.

It returns **every** reason, not the first, and the HTTP boundary returns `422` with them.

## Seam 3 — fixture data that the product's own validation rejects

`fixtures/invoices.json` shipped `INV-4473`'s known payer as **41** hex digits. Two phases never
noticed, because `classify()` only normalises case and compares addresses as strings. The first
thing that would have rejected it was the new intake schema — i.e. the demo fixture was not
registrable through the product's own path.

Detection:

```python
import json, re
f = json.load(open('fixtures/invoices.json'))
[print('BAD', a) for i in f['invoices'] for a in i['knownPayerAddresses']
 if not re.fullmatch(r'0x[0-9a-fA-F]{40}', a)]
```

Fix: corrected the address, then pinned it twice — a test asserting every payer / payable / token
address is 40 hex digits, and the fixture being parsed through `IntakeRequestSchema` (the identical
schema `POST /invoices` enforces), not just through the semantic rules. A fixture only the seed
script can load proves something about the seed script.

Adjacent lesson: hand-typing a long hex string into a test or payload is how the defect got there.
Build payloads from the fixture programmatically (a small script that reads the fixture and emits
the JSON) whenever an address, hash or id must appear in more than one place.

## Plus: operator routes were unauthenticated

`POST /invoices` (register a receivable, i.e. decide who gets paid) and the workflow callback had
no auth. Fix: `BRIDGE_ADMIN_TOKEN` in an `x-trueup-admin-token` header, compared as SHA-256 digests
via `timingSafeEqual` (hash both sides first so a length mismatch cannot leak or throw), and when
the variable is **unset** the routes return `503 admin_api_disabled` rather than running open.

## Live verification that was accepted as proof

Quoted numbers matter more than adjectives. What was actually run:

| Step | Result |
| --- | --- |
| `pnpm test` / `tsc --noEmit` | 177 tests / 12 files pass, clean |
| Seed through intake | 3 invoices, 5 payables, each bound (`PAY-4472-CARRIER` → `INV-4472`, …) |
| Load the **real** pre-change ledger file | `WARNING: migrated ledger to v2: dropped 3 unbound supplier row(s) from v1` |
| Rehearsal against the live execution API | `matched` INV-4471 at **0.95**, 3 payouts simulated, gas `45247 / 62796 / 62796`, ledger `0.00/open -> 0.00/open (unchanged)` |
| Signed webhook replay over HTTP | valid delivery `200 matched` 0.95 with all three payouts; tampered body `401 digest_mismatch`; 5/5 harness expectations pass |
| Intake over HTTP | no token `401`; valid `201`; payables totalling 12.00 vs an 18.00 invoice `422` "18.00 minus 12.000000 would be collected and never paid out" |
| `GET /invoices` | each invoice listed with only its own payables |

## Sequenced fix order that worked

1. Model fix first (`Payable` + required-arg accessor) — it changes the shape of everything else.
2. Then the missing-configuration guard (`held` + reason).
3. Then intake (schema, rules, HTTP, CLI) and route the seed through it.
4. Then auth on the operator routes.
5. Then the fixture repair + tests that pin each invariant.
6. Then docs: README status table, architecture data-flow, `limits.md` with the new items
   (no release path for a held settlement, one shared token/one org, intake does not deliver the
   payment request, no cancel/credit note), and the runbook.

## Environment note

Verifying "live" while a stale bridge still held port 8787 produced `missing_secret` on every
delivery — the new process had failed to bind (`EADDRINUSE`) and the old one was answering. See
`service-config-loading` for the port/PID check and the Windows kill command; on MSYS,
`taskkill //F` is mangled by path conversion, so kill by pid with PowerShell `Stop-Process`.
