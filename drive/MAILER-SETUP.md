# ARTGEOrge Drive — cross-device backend setup

Drive stores your account and files in the cloud so you can sign in from any
device. The backend is one Cloudflare Worker (`worker.js`) using:

- **D1** (SQL database) — accounts + file/folder metadata. No card needed.
- **KV** (key-value store) — file contents (≤ 25 MB each). No card needed.
- **Resend** — emails the 6-digit sign-in code (no phone signup).

The existing `drive-mailer` Worker is reused — same URL, same secrets. You just
paste the new code and add two bindings (D1 + KV).

## 1. Create the D1 database

1. Cloudflare dashboard → **Storage & Databases → D1 SQL Database → Create**.
2. Name it `drive-db` → **Create**. (Tables are created automatically on first
   request — no SQL to run.)

## 2. Create the KV namespace

1. **Storage & Databases → KV → Create a namespace**.
2. Name it `drive-files` → **Add**.

## 3. Update the Worker code

1. **Workers & Pages → drive-mailer → Edit code.**
2. Select all, delete, then paste the contents of `drive/worker.js` → **Deploy**.

## 4. Bind D1 and KV to the Worker

Worker → **Settings → Bindings → Add**:

- **D1 database binding:** Variable name **`DB`** → choose `drive-db`.
- **KV namespace binding:** Variable name **`FILES`** → choose `drive-files`.

(The variable names `DB` and `FILES` must match exactly.) **Deploy** again.

## 5. Variables (already set from before)

These should already exist from the mailer step; confirm they're present:

- `RESEND_API_KEY` (secret) · `CODE_SECRET` (secret)
- `MAIL_FROM` = `ARTGEOrge Drive <onboarding@resend.dev>`
- `ALLOW_ORIGIN` = `https://artgeorge.github.io`

## Done

`drive/index.html` already points `API` at the Worker, so once the code +
bindings are deployed, sign-in, files, and folders all sync via the cloud and
work from any device/browser.

## Limits & notes

- **Files ≤ 25 MB each**, ~1 GB total, ~1,000 uploads/day (KV free tier).
- Without a custom domain, Resend only emails the **owner's address**
  (G2a2p14@gmail.com). To let other people sign up and receive codes, verify a
  domain in Resend and update `MAIL_FROM`.
- Passwords are PBKDF2-hashed server-side; sessions are HMAC-signed tokens
  (30-day) stored in the browser. Files are private per account.
