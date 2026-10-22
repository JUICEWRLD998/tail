# Telegram demo: what to record

You record the Telegram part with real calls on the deployed bot. No voice, no editing. I add the voice-over, captions,
the pitch-deck slides, the web pages and the ending, and cut your clips into the final video.

Final video target: about 2 minutes, of which your clips make up roughly 50 seconds. You shoot more than that (about
4 minutes raw) so I can pick the best takes. Everything on screen must be real: a real call, a real tap, a real Strike
order. If a step fails, do not fake it. Tell me what happened and re-shoot it.

---

## 1. Before you record (10 minutes)

| Check | How |
|---|---|
| The service is awake | Open `https://<your-service>.onrender.com/health`. It must say `{"ok":true}`. Keep an uptime monitor pinging it every 5 minutes while you shoot, or the free plan sleeps and the database is wiped. |
| The production bot is in your test channel | Channel, Administrators, add the production bot, allow posting, editing and deleting messages. |
| Your follower wallet has testnet funds | Use the MetaMask account that holds your Strike testnet deposit (the one that starts `0x0C3a`). The bot sizes the trade from that account's Strike equity. With zero margin it refuses, and that is not a demo. |
| One Telegram account is enough | The same account can be the caller and the follower. That worked in testing. Two accounts (a second one on your phone) make a clearer story but are optional. |
| You know the live price | Run this in PowerShell, right before each call: `(Invoke-RestMethod "https://api-v2-testnet.strikefinance.org/price/v2/premiumIndex?symbol=ETH-USD").markPrice` |

**Only ETH-USD works.** Every other testnet market has a broken order book. Every call you post must be ETH-USD.

### Screen setup

- **Telegram Desktop**, dark theme, the window around 1280x720 or larger, interface scale 110 to 125% so text is readable
  at video size. Telegram Web also works.
- **Record at 1920x1080, 30 fps** (OBS, or Windows Game Bar `Win+Alt+R`). Show the mouse cursor. Capture the Telegram
  window only, not your whole desktop.
- **Hide the noise:** turn on Do Not Disturb, close other chats from view, nothing with your phone number, other people's
  names or messages. Close any window showing `.env`, the Render dashboard or any token. Never record a secret.
- Keep the **chat list narrow** or capture only the chat pane.
- Move the mouse slowly and click deliberately. Pause for 2 seconds after every bot reply so the text can be read.
- Type nothing live. **Paste** every call from the blocks below, so there are no typos.

### Compute your levels (every call)

Read the live ETH-USD mark price with the command above, then:

- A call that will **finish quickly** (use this one when you want the receipt): `TP = mark + 3`, `SL = mark - 12`
- A call that will **stay open** (use this for the ask flow or the Fade quote): `TP = mark + 30`, `SL = mark - 20`

Round to whole numbers. Testnet prices drift a few points a minute, so post the call within a minute of reading the
price. If the price moves past your target before you tap Tail, the bot says "The price has moved past this call's stop or
target." Post a fresh call.

The bot refuses a call identical to one posted in the last 2 minutes, and more than 10 calls an hour per channel. Vary the
levels slightly between takes.

---

## 2. The clips

Record each clip separately, start to finish, and name the file as shown. Say nothing; I add the voice.

### C1. Register the channel (about 20 s) `c1-register.mp4`

Skip this if you already registered the channel with the production bot.

1. In a private chat with the production bot, send `/start`. Pause on the welcome message.
2. Send `/addchannel`. The bot replies with a code like `TAIL-AB12CD`.
3. Open your test channel and paste the code as a normal message. The bot deletes it.
4. Back in the private chat: the bot says **Registered** with your channel's name.

*Shows: a caller connects a channel in one step.*

### C2. Post a call (about 25 s) `c2-post-call.mp4`

1. Read the mark price. Compute a quick-finish call, then paste it into the channel (replace the numbers):

   ```
   ETH-USD LONG NOW
   TP <mark+3>
   SL <mark-12>
   5x
   ```

2. Within a second the bot sends you a private **Post this call?** card with the entry, target, stop and R:R. Pause on it.
3. Tap **Post**.
4. The call card appears in the channel with **Tail** and **Fade** buttons and a counter. Pause on it for 3 seconds.

*Shows: any message becomes a clean card. The caller confirms before anything is posted.*

### C3. The parser asks instead of guessing (about 20 s) `c3-ask.mp4`

1. Paste a call with no direction (use levels around the live price):

   ```
   ETH-USD 2400 TP 2430 SL 2380
   ```

2. The bot DMs a question: **Long or short on ETH-USD?** with two buttons. Pause on it.
3. Tap **Long**. The confirm card appears. Tap **Drop**, so the channel stays clean.

*Shows: the model never guesses an order; an unclear call becomes one question.*

### C4. Optional: the AI reader (about 20 s) `c4-ai.mp4`

Only if you set `OPENROUTER_API_KEY` on Render. Use a message in plain English, with levels around the live price:

```
ETH is going up from here, I am long at <mark> targeting <mark+30>, protect at <mark-20>
```

The bot DMs a confirm card with the line **Read by AI from your message. Check every price before you post.** Pause on
it, then tap **Drop**.

*Shows: unreadable messages get an AI reading, but a human must confirm it and every number must be in the message.*

### C5. A follower tails the call (about 60 s) `c5-tail.mp4`

Use the quick-finish call from C2 (or post a fresh one). Tap **Tail** on its card. Then:

1. The bot opens. **First time only:** it sends a **Connect wallet** button. Tap it. The web page opens.
2. Choose MetaMask, sign the one message, and wait for the page to say **Linked**. Go back to Telegram.
   (If you are already linked, skip steps 1 and 2.)
3. Tap **Tail** on the card again. The bot sends the quote. Pause 3 seconds so it can be read: entry, target, stop, the size,
   the risk in USD against your own equity, R:R, and the builder fee line.
4. Tap **Confirm**. The bot replies **Filled** with a Strike order number. Pause.
5. Go back to the channel: the card counter now reads **Tailed 1**. Pause.

*Shows: one tap places a Strike bracket order, sized to the follower's own risk, in seconds.*

### C6. Fade (about 15 s) `c6-fade.mp4`

On a different open call (use the stay-open levels), tap **Fade**. The quote shows the **opposite side** with the target and
stop swapped, and the inverted R:R. Pause on it, then tap **Cancel**. Do not confirm.

*Shows: take the other side of any call in one tap.*

### C7. The result (about 30 s) `c7-result.mp4`

Keep the bot open and wait for the quick-finish call to reach its target or stop. The bot checks every 30 seconds.
Record this as one clip, starting from the card and ending with the result:

1. A reply appears under the card: **Target hit** (or **Stopped out**) with the result in R and the entry, target and mark.
2. The card itself gets a result line.
3. In your private chat you also get **Closed at take profit** (or **Stopped out**) with the realized PnL.

You can stop recording while you wait and resume the instant the reply lands. I cut out the waiting. If it takes longer
than 10 minutes, post another quick-finish call.

*Shows: results come from the market, not from the caller.*

### C8. The caller's side (about 40 s) `c8-caller.mp4`

In the private chat with the bot, send these one at a time and pause on each reply:

1. `/record`: calls, hit rate, average result, followers in.
2. `/earnings`: the estimated builder fee.
3. `/setcode sigma 10`: the bot checks the code with Strike, then confirms that Strike pays the owner of the code directly.
   (You own `sigma`, so this is truthful.) Send `/earnings` again: it now says who gets paid.
4. `/publish`: the bot replies with a public page link. Copy it.

*Shows: the caller's record and earnings, computed from real fills, and a caller paid by Strike through their own code.*

### C9. The public page (about 20 s) `c9-page.mp4`

Open the link from `/publish` in your browser. Slowly scroll from the top: the record, the charts, the latest call as a
ticket, the builder fee and the calls table. Record the browser window.

*Shows: every number a caller publishes is computed from real calls and fills.*

### C10. Proof on Strike (about 20 s) `c10-strike.mp4`

Open Strike's testnet app (`testnet.strikefinance.org`) with your account. Show the open **position** and its **take-profit
and stop** orders from your Tail order, so it is clear the bracket is real and sits on Strike. Do not show any menu with
keys or settings.

*Shows: the order is on Strike, not in our database.*

---

## 3. Order to shoot

C1, C2, C3, C4 (optional), then C5. Start C7 straight after C5, because the quick-finish call needs time to resolve, and
shoot C6 and C8 to C10 while you wait.

## 4. What not to show or do

- No tokens, keys, `.env`, the Render dashboard, or anything with a secret.
- Nothing from a private chat other than the bot.
- Do not confirm a Fade. Cancel it.
- Do not post anything in a public channel other than your own test channel.
- If the bot replies with an error, stop that clip, send me the message and the time, and shoot again.
- Do not edit or speed up clips. I handle all of that.

## 5. What to send me

1. The **live URL**: `https://<your-service>.onrender.com`.
2. The clips `c1` to `c10`, with the optional `c4` only if it worked. Upload them here, or put them in one shared folder
   (Drive, Dropbox, WeTransfer) and send the link.
3. One line saying which clips were retakes, and anything that went wrong.

I then run the demo skill: the pitch-deck slides, my recordings of the live site, your clips placed under the voice-over,
captions, and the ending. You get a 1080p MP4, the script, a subtitles file and a thumbnail.
