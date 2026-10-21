---
name: product-hardening
description: Use when a demo or prototype must become a real product.
---

# Product Hardening (prototype → real product)

## When to use

- The user asks "is this a real product or just a demo?", "make sure this isn't a demo",
  "can this handle real customers/money?"
- You (or another agent) built a service for a hackathon, a pitch, or a spike, and it is about
  to be pointed at real data, real balances, or a real operator.
- You are reviewing an agent-built service for correctness on the paths that move value.
- A build has green tests and a rehearsed demo, yet the user distrusts it. That distrust is
  usually well-founded and always checkable — see the seam taxonomy below.

**Core stance:** demo code and product code can be byte-identical on the happy path and differ
entirely in their *input* paths and their *failure* paths. So do not review by reading the happy
path — ask two questions: (1) where does data actually enter this system, and (2) what happens on
the path that pays the wrong party? Then look, with `search_files`, at the answer.

## The seam taxonomy (what "demo-shaped" looks like in code)

| Seam | Why it survives the demo | Detection |
| --- | --- | --- |
| **Lookup ignores its parent** — e.g. `suppliersForInvoice()` takes no argument and returns every row | With one invoice in the fixture, a global list is indistinguishable from a filtered one | Read every query signature: does it take the id it is supposed to scope by? A no-arg or unused-arg lookup feeding a write path is the top seam |
| **Fixture-only input path** — the only way rows enter is a seed script reading a committed fixture | The demo never needs to ingest anything the fixture does not contain | grep the writers (`addX(`, `INSERT`, `store.`) and see who calls them: if only `scripts/seed-*` does, the product has no input |
| **Fixture data that fails the product's own validation** | Nothing validates the fixture; downstream code only compares fields as strings | Parse the demo fixture through the *production* schema in a test. In one session the fixture's payer "address" was 41 hex digits — every consumer compared addresses as strings, so two phases never noticed |
| **Unvalidated operator endpoints** | The demo has no adversary and one trusted operator | Check every non-public route for auth, and check what happens when the token env var is *unset* (open vs refuse) |
| **Hardcoded entity ids in scripts** | The recording always uses the seeded invoice/order/pair | grep the fixture ids across `scripts/` and docs; a tool that only works on one row is a rehearsal of that row |
| **Stands in for a live service** | The real trigger (webhook, event) is not wired yet, so a script synthesises the event | Legitimate as a rehearsal tool — a seam only if it is the *sole* way the loop has ever run, or if product code reads synthesised fields |
| **Silent no-op where a decision belongs** | Nothing fails; the demo just quietly does nothing | Find branches that return success with zero actions. "Matched and paid nobody" must be a distinguishable outcome, not an empty list |

## Fix patterns (structural, not local)

- **Bind the obligation to its parent in the type.** Replace parent-less rows with a row carrying
  a required parent id, and make the accessor take that id as a **required argument**
  (`payablesForInvoice(invoiceId)`). The parent-blind call then no longer type-checks, so the bug
  cannot be re-written by accident and survives every future review.
- **Make intake the only writer, with one implementation shared by every entry point.** HTTP
  endpoint, CLI, and tests call the same `registerX()`. A rule enforced on one path and skipped on
  another is worse than no rule, because the tests then prove nothing about the other path.
- **Refuse at intake what would fail at execution.** A payout above the platform cap, a row with
  no token address (which silently becomes a native transfer), parts that do not sum to the whole,
  a currency whose limit you cannot state, re-registering a settled/closed record. List **every**
  reason, not the first, so an operator fixes a payload in one pass.
- **Make the missing-configuration case loud.** A matched record with no children is a
  configuration failure: record it with an explicit status (`held`) and a reason naming the fix,
  never as a success record with an empty array.
- **Version the store and migrate loudly.** On a shape change add a version, and *drop* records
  that cannot be migrated honestly (no parent id → no way to place them), with a warning on every
  load path (startup banner, seed scripts, CLIs). Never guess a binding: guessing pays the wrong
  party.
- **Guard operator routes with a token that refuses when unset** (503, not open). An intake
  endpoint decides who gets paid; "nobody set the token" must not mean "anyone who can reach the
  port may register a payout address". Compare constant-time over digests.
- **Keep the demo harness, but route it through the product's own rules.** The seed script should
  call the same validator the HTTP endpoint does, so a fixture that breaks a rule fails there
  with the same message a real payload would get.

## Verification (the deliverable is live evidence, not a description)

Run the real paths and quote the output:

1. Test suite + type-check — a floor, not evidence.
2. **Seed through the product's intake**, not around it.
3. **Migrate a real old file**, not a synthetic one: take the pre-change ledger/state file, load
   it, read the warning. "dropped N unbound row(s) from v1" is evidence; a unit test with an
   inline literal is not.
4. **The headline loop against the live dependency** (its simulation/dry-run path where one
   exists). Quote verdict, confidence, per-payout gas estimates, and that state was unchanged.
5. **The HTTP surface**: one unauthenticated request (expect 401/503), one valid (expect 201, then
   read it back), one deliberately broken (expect 422 + the exact reason you designed), then GET
   the book and show each parent with only its own children.
6. **The trigger path over HTTP** (signed webhook / replay harness) — re-run it after any
   route-table edit, because a new route can shadow an old one.

Add the two tests that would have caught the seams: **the demo fixture must parse through the same
schema a customer payload does**, and the binding must be pinned by a case where one counterparty
appears on two parents (settling one must pay only that one).

## Reporting shape for this user

- Lead with **what was actually wrong**, naming `path:line` — not with what you changed.
- Then the structural fix. He rejects local patches to systemic seams.
- Then **what was verified, with real output quoted** (counts, codes, gas estimates, hashes). He
  judges by execution evidence, not prose.
- Then, plainly, **what remains demo-only** (shared token / single tenant, file storage, unwired
  triggers, no release path). He distrusts a report with no remaining limitations.
- No cheerleading, no process narration, no restating the plan back.

## Pitfalls

- Do not answer "is this a real product?" from the README or the test count. Both are usually
  written by the thing being reviewed.
- Do not fix a seam at the call site. If the lookup is wrong, change the signature so the wrong
  call cannot be written; a guard at one call site leaves the next one wrong.
- Do not rewrite a fixture to make a test pass without asking what the fixture was asserting.
  Demo fixtures are load-bearing evidence for the demo: change them with a comment naming the
  invariant, and pin the invariant in a test.
- Do not destroy the demo. The recording may still be the deliverable that week — harden the code
  and keep `seed-<demo>` working (have it skip closed records and say so, rather than rewriting
  history the settlement records point at).
- A background process still holding the port makes "live" verification silently exercise the old
  code — see `service-config-loading` for the check and the kill command.

## References

- `references/demo-seam-audit.md` — the worked audit this skill was distilled from: the exact
  seams found in an agent-built payment-reconciliation service, the fixes in prose, and the live
  verification transcript.
