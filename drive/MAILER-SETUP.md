# ARTGEOrge Drive — email verification setup

Drive emails a 6-digit code on sign-in. Sending real email from a static
site needs a tiny serverless function. This folder ships one:
`mailer-worker.js` (a Cloudflare Worker). Until you deploy it, Drive falls
back to showing the code on screen so you can still test the flow.

## 1. Set up Resend (no phone, no domain)

This Worker uses **Resend** by default. Resend signs up with GitHub or
email — **no phone number** — and its built-in `onboarding@resend.dev`
sender needs **no domain**.

1. Sign up at <https://resend.com/signup> (GitHub login is quickest).
2. **API Keys → Create API Key.** Copy it (`re_...`).

> Limitation without a domain: Resend only delivers to **your own**
> Resend account email. That's fine for a personal Drive (you sign in with
> that email). To email *other* people, add a domain later and set
> `MAIL_FROM` to it. (Brevo is a no-domain alternative that can email anyone,
> but its signup requires a phone number.)

## 2. Deploy the Worker

1. Cloudflare account → **Workers & Pages** → **Create Worker**
   (Cloudflare signup is email + password, no phone).
2. Replace the starter code with the contents of `mailer-worker.js` → **Deploy**.
3. Worker → **Settings → Variables and Secrets**, add (encrypt the secrets):
   - `RESEND_API_KEY` — the key from step 1
   - `MAIL_FROM` — `ARTGEOrge Drive <onboarding@resend.dev>`
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
