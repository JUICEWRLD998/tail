# Unseen call fixtures: provenance

These messages were collected on 2026-10-22, **before** the parser was run on them, to measure it on text it was not
written against. Each `.txt` header says where it came from; each `.expected.json` was written from the product rules
before the first run (see `DECISIONS.md`, P6).

| Source | Count | What it is | Licence |
|---|---|---|---|
| lukacsaron/telegram-signal-test-corpus | 16 | 11 message shapes quoted from live Telegram channels (`spec`), 5 synthetic tolerance cases | MIT, published by jazzrabbit OU |
| dupipcom/iris README | 6 | one trading bot's documented signal format | not checked |
| joostmbakker/telegram-crypto-signal-parser README | 1 | a signal from a Telegram channel | not stated |
| Cornix public feedback board | 1 | a user's example of a parsed signal | not stated |

Not captured from a live channel by this project: Tail has no access to anyone's channel history. Eleven of the 24 are
quoted live-channel shapes, the rest are documentation examples or synthetic. The corpus is gold and forex
heavy (XAUUSD); the market list used in the test is a test context, not Strike's list.

The Cornix example was reconstructed from a search-result summary; the corpus and iris messages were read from the
source files or pages.
