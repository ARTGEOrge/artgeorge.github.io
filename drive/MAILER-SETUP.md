# ARTGEOrge Drive — email verification setup

Drive emails a 6-digit code on sign-in. Sending real email from a static
site needs a tiny serverless function. This folder ships one:
`mailer-worker.js` (a Cloudflare Worker). Until you deploy it, Drive falls
back to showing the code on screen so you can still test the flow.

## 1. Pick an email provider

You need an API key from a transactional-email service:

| Provider | Free tier | Domain needed? |
|----------|-----------|----------------|
| **Resend** (default) | 100/day, 3000/mo | **Yes** — verified domain to email anyone |
| **Brevo** | 300/day | **No** — verify a single sender address |
| **SendGrid** | 100/day | No — single-sender verification |

`github.io` can't be domain-verified (no DNS control), so if you don't own
a custom domain, use **Brevo**: in `mailer-worker.js` call `sendEmailBrevo()`
instead of `sendEmail()` and set the Brevo variables below.

## 2. Deploy the Worker

1. Cloudflare account → **Workers & Pages** → **Create Worker**.
2. Replace the starter code with the contents of `mailer-worker.js` → **Deploy**.
3. Worker → **Settings → Variables and Secrets**, add (encrypt the secrets):
   - `CODE_SECRET` — any long random string (signs the codes)
   - `ALLOW_ORIGIN` — `https://artgeorge.github.io`
   - **Resend:** `RESEND_API_KEY`, `MAIL_FROM` = `ARTGEOrge Drive <drive@yourdomain.com>`
   - **Brevo (no domain):** `BREVO_API_KEY`, `MAIL_FROM_EMAIL` = your verified
     sender, `MAIL_FROM_NAME` = `ARTGEOrge Drive`
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
