# Somnia / DreamDEX technical stack + Event Contracts Hackathon (verified 2026-08)

Somnia = "Agentic L1", EVM-compatible, ~1M TPS, sub-second finality, IceDB (15–100ns reads), MultiStream Consensus, sub-cent fees.

## Event Contracts (the judged primitive, on DreamDEX)
- Fixed-duration Up/Down contracts on BTC/ETH: 15-minute or 1-hour windows. Fixed payout, zero fees, fully on-chain CLOB.
- Price = the Up probability in (0,1); Down price = 1 − Up. "One book, two sides" — two opposite buyers can cross with no seller (pool mints a fresh Up/Down pair).
- Complete sets: 1 USDso ⇄ 1 Up + 1 Down (sell-side inventory / LP). Markets auto-roll: hard expiry, successor respawns; settled markets leave the live list (winnings claimed by scanning recently-settled).
- SDK `@somnia-chain/markets-sdk` (TypeScript, npm, ≥0.28.0): discover markets, stream books/fills/candles, place/cancel orders by symbol, mint/merge complete sets, redeem winners. HTTP API covers spot only (no event-contract endpoints). Symbols like `BTC-0-12AUG26-1600/USDso#YES`. On-chain market status 1 = Trading (gate writes on live status; indexer lags). No API rate limits.

## Somnia Agents (on-chain AI, live testnet+mainnet, same agentId)
- Three base agents: (1) JSON API Request — fetch/parse external API in-tx, ~0.03 STT/validator; (2) LLM Inference — deterministic Qwen3-30B, temp 0, constrained output set, ~0.07 STT/validator; (3) LLM Parse Website — scrape + structured extract.
- Subcommittee default 3; validators re-run and must produce byte-identical output (consensus-verified). Async: result returns via a `receive()`/`handleResponse` callback.
- Gotchas: implement `receive() external payable` (rebates, else funds stick); `handleResponse` is external (anyone can call — gate it); handle Success/Failed/TimedOut; add `pricePerAgent × subcommitteeSize` on top of the base fee.

## On-chain Reactivity (Somnia-only)
- Contract subscribes via precompile `0x0100`; validators inject a synthetic tx in the SAME ~100ms block to call the handler — no keeper, no server. `@somnia-chain/reactivity-contracts` (`SomniaEventHandler`, `SomniaExtensions.subscribe`). Contract owns subscription + pays gas (needs ≥32 SOMI).
- System events `BlockTick`/`EpochTick`/`Schedule` are fabricated `0x100` logs → self-scheduling upkeep. Somnia's docs: "no other EVM can do this."
- Pitfalls: avoid recursive subscriptions (drain risk); only successful-tx logs trigger; redeploying a handler requires a new subscription.

## Event Contracts Hackathon (the brief)
- "Build the next generation of prediction market experiences on DreamDEX." $5,000 pool, virtual, deadline 2026-09-08. Open track.
- Judging: Innovation & Originality 20% · Technical Implementation 25% (depth of Event Contracts + SDK use) · UX & Design 20% · Business & Ecosystem Impact 20% (attract users, generate trading activity, increase Event Contracts adoption, expand DreamDEX) · Presentation & Demo 15%.
- Submission: working prototype on testnet + GitHub repo + 2–3 min demo video (deck optional). Resources: `github.com/somnia-chain/dreamdex-bot-kit`, `dreambot-builder.vercel.app`, `docs.dreamdex.io/developers/event-contracts`.
- Track example bullets (generic — avoid cloning): consumer trading apps, AI/agentic apps, trading infrastructure, community/social products.

## Adjacent/competitor context
- Prophecy Social (Somnia's own flagship: prompt→market→AI-resolved, ~31k users) — do NOT clone this.
- Algo Arena (agent-vs-agent competition) and DreamDEX Bot Kit (5 strategies incl. market-making, session keys, EIP-7702 batching).
- External: Polymarket / Kalshi / CME event contracts (multi-day discrete or centralized), on-chain options protocols (Lyra, Derive — real options, liquidation risk). None offer 15-min zero-fee binaries + on-chain AI.
