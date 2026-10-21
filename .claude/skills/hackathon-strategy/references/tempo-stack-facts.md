# Tempo stack facts (measured 2026-10-10 on Moderato, viem 2.57.4)

Only for Tempo events. Measured during the Crypto World's Fair pass (pick: Upkeep). Re-check versions first.

## Access keys (TIP-1011, live since T3: testnet 2026-04-21, mainnet 2026-04-27)

- `Actions.accessKey.authorizeSync(client, { accessKey, expiry, limits: [{ token, limit, period }], scopes: [{ address, selector, recipients }] })`.
  `period` in seconds, 0 = one-time. `recipients` applies only to `transfer`, `approve`, `transferWithMemo`.
- The key can be a WebCrypto P256 key (`Account.fromWebCryptoP256(keyPair, { access: root })`), so a browser can
  hold it. The root can authorize from a public key alone (`resolveAccessKey({ publicKey, type })`).
- `Account.fromWebAuthnP256` takes no `access` option; a passkey as an ACCESS key is unproven.
- Refusals arrive at simulation (about 250 ms, nothing mined): `Account keychain error: CallNotAllowed`,
  `SpendingLimitExceeded`, and after revoke `KeyAlreadyRevoked`.
- **Trap: a fee paid in the capped token is counted against the cap** ($4 spend left 5.9998 of 10). Sponsor fees or
  pay them in a different stablecoin.
- Spend attribution: precompile `0xaaaaaaaa00000000000000000000000000000000` emits per spend
  topics `[0xe0815e3aaadddf4dd75bde97fc060f0c38afe18e87a169be86a3f5c28247f192, account, keyId, token]`,
  data `[amount, remaining]` (one event for the fee, one for the transfer).
- The field (about 40 public entries, Oct 2026) used access keys only for AI agents, because the docs page is
  titled "Give an agent access".

## Virtual addresses (TIP-1022)

- `VirtualMaster.mineSaltAsync({ address })` is a 32-bit proof of work. Default range is 2^32 salts; it can return
  `undefined` (about 37% of runs). Run 1 exhausted the range in Node with 3 workers; run 2 with
  `start: 2n ** 32n` hit in 60 s. **Always handle `undefined`, pass a bigger `count`, mine once offline, store the salt.**
- `Actions.virtualAddress.registerMasterSync(client, { salt })`, then `VirtualAddress.from({ masterId, userTag })`.
- An access key's `recipients` list accepts a virtual address; the payment forwards to the master with two
  Transfer events (sender -> virtual, virtual -> master).

## Misc

- Faucet: `Actions.faucet.fundSync(client, { account })` (AlphaUSD `0x20c0…0001` and others, 1M each).
- AlphaUSD has 6 decimals. `Actions.token.getBalance` returned a non-number to a naive formatter in the spike;
  check its return shape before formatting.
- No payments or ramps partner names Africa or NGN (docs/partners/payments-and-ramps.md, 2026-10-10).
