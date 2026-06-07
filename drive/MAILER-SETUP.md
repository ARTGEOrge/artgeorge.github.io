# ARTGEOrge Drive — email verification setup

Drive emails a 6-digit code on sign-in. Sending real email from a static
site needs a tiny serverless function. This folder ships one:
`mailer-worker.js` (a Cloudflare Worker). Until you deploy it, Drive falls
back to showing the code on screen so you can still test the flow.

## 1. Set up Brevo (no domain needed)

This Worker uses **Brevo** by default — it only needs one *verified sender
address*, not a domain (free tier: 300 emails/day).

1. Sign up at <https://www.brevo.com>.
2. **Senders, Domains & Dedicated IPs → Senders → Add a Sender.** Enter a
   name and an email you control (e.g. your `outlook.com` address). Brevo
   emails you a confirmation link — click it to verify the sender.
3. **SMTP & API → API Keys → Generate a new API key.** Copy it.

> Want Resend later (if you get a custom domain)? The Worker still includes
> `sendEmail()` for Resend — set `RESEND_API_KEY` + `MAIL_FROM` and call
> `sendEmail()` instead of `sendEmailBrevo()` in `handleSend()`.

## 2. Deploy the Worker

1. Cloudflare account → **Workers & Pages** → **Create Worker**.
2. Replace the starter code with the contents of `mailer-worker.js` → **Deploy**.
3. Worker → **Settings → Variables and Secrets**, add (encrypt the secrets):
   - `BREVO_API_KEY` — the API key from step 1
   - `MAIL_FROM_EMAIL` — the sender address you verified in Brevo
   - `MAIL_FROM_NAME` — `ARTGEOrge Drive` (optional)
   - `CODE_SECRET` — any long random string (signs the codes)
   - `ALLOW_ORIGIN` — `https://artgeorge.github.io`
4. Copy the Worker URL, e.g. `https://drive-mailer.yourname.workers.dev`.

## 3. Point Drive at it

In `drive/index.html`, set:

```js
var MAILER = { url: "https://drive-mailer.yourname.workers.dev" };
```

Commit + push. Codes now arrive by email; the on-screen fallback turns off.

## How it stays secure

The Worker generates the code, emails it, and signs `email|exp|code` with
`CODE_SECRET` into a token. The token (not the code) goes to the browser.
On verify, the browser sends back the typed code + token; the Worker
recomputes the signature. The code is never stored and never returned, and
the token can't be forged without the secret.

> Caveat: Drive's files live in the browser (IndexedDB) and the final
> "grant access" happens client-side, so this is solid email verification,
> not server-enforced auth. Good for this local-accounts app; a true
> multi-user backend would store accounts and files server-side.
