/**
 * ARTGEOrge Drive — verification-code mailer (Cloudflare Worker)
 * =============================================================
 * Sends a 6-digit sign-in code by email and verifies it. Stateless:
 * the code is signed into an HMAC token (never stored, never returned),
 * and the browser sends the token back with the user-typed code to verify.
 *
 * Deploy (free):
 *   1. Create a Cloudflare account → Workers & Pages → Create Worker.
 *   2. Paste this file as the Worker code and Deploy.
 *   3. In the Worker's Settings → Variables, add these (Encrypt the secrets):
 *        RESEND_API_KEY  your Resend API key (re_...)
 *        MAIL_FROM       "ARTGEOrge Drive <onboarding@resend.dev>"  (no domain needed)
 *        CODE_SECRET     any long random string (used to sign codes)
 *        ALLOW_ORIGIN    https://artgeorge.github.io   (use * only while testing)
 *   4. Copy the Worker URL (https://drive-mailer.YOURNAME.workers.dev)
 *      and paste it into MAILER.url in drive/index.html.
 *
 * Email provider: this Worker uses **Resend** (sendEmail). Resend signs up
 * with GitHub/email — no phone number. Without your own domain it sends from
 * onboarding@resend.dev and can only deliver to YOUR OWN account email, which
 * is fine for a personal Drive. To email other people later, verify a domain
 * (set MAIL_FROM to it), or swap in sendEmailBrevo() for a no-domain sender.
 */

const TTL_MS = 10 * 60 * 1000; // codes valid for 10 minutes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genCode() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  return String(n % 1000000).padStart(6, "0");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function emailHtml(code) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;
    background:#1c1726;color:#e8eaed;border-radius:14px;padding:28px;border:1px solid #2b2238">
    <div style="font-size:22px;font-weight:800">
      <span style="color:#a78bfa">ARTGEOrge</span> Drive</div>
    <p style="color:#b8b2c6">Here is your sign-in code:</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#cdbcff;
      background:#241d33;border-radius:10px;padding:16px;text-align:center;margin:14px 0">${code}</div>
    <p style="color:#8b8595;font-size:13px">This code expires in 10 minutes.
      If you didn't request it, you can ignore this email.</p>
  </div>`;
}

// ---- Resend (DEFAULT — no-phone signup; onboarding@resend.dev needs no domain) ----
// Without a verified domain, Resend only delivers to your own account email.
async function sendEmail(env, to, code) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject: `Your ARTGEOrge Drive code: ${code}`,
      html: emailHtml(code),
      text: `Your ARTGEOrge Drive verification code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!r.ok) throw new Error("resend " + r.status + ": " + (await r.text()));
}

// ---- Brevo (alternative; no domain — but signup requires a phone number) ----
// Set BREVO_API_KEY + MAIL_FROM_EMAIL (+ optional MAIL_FROM_NAME) and call this
// instead of sendEmail() in handleSend().
async function sendEmailBrevo(env, to, code) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: env.MAIL_FROM_EMAIL, name: env.MAIL_FROM_NAME || "ARTGEOrge Drive" },
      to: [{ email: to }],
      subject: `Your ARTGEOrge Drive code: ${code}`,
      htmlContent: emailHtml(code),
    }),
  });
  if (!r.ok) throw new Error("brevo " + r.status + ": " + (await r.text()));
}

async function handleSend(env, origin, email) {
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "invalid email" }, 400, origin);
  const code = genCode();
  const exp = Date.now() + TTL_MS;
  const sig = await hmacHex(env.CODE_SECRET, `${email}|${exp}|${code}`);
  try {
    await sendEmail(env, email, code); // Resend: no phone signup; onboarding@resend.dev emails your own address
  } catch (e) {
    return json({ ok: false, error: "email failed", detail: String(e.message || e) }, 502, origin);
  }
  return json({ ok: true, token: `${exp}.${sig}`, exp }, 200, origin);
}

async function handleVerify(env, origin, email, code, token) {
  const dot = (token || "").indexOf(".");
  if (dot < 0) return json({ ok: false, error: "bad token" }, 400, origin);
  const exp = parseInt(token.slice(0, dot), 10);
  const sig = token.slice(dot + 1);
  if (!exp || Date.now() > exp) return json({ ok: false, error: "expired" }, 200, origin);
  const expect = await hmacHex(env.CODE_SECRET, `${email}|${exp}|${(code || "").replace(/\D/g, "")}`);
  return json({ ok: timingSafeEqual(expect, sig) }, 200, origin);
}

export default {
  async fetch(req, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405, origin);

    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400, origin); }

    const email = (body.email || "").trim().toLowerCase();
    if (body.action === "send") return handleSend(env, origin, email);
    if (body.action === "verify") return handleVerify(env, origin, email, body.code, body.token);
    return json({ ok: false, error: "unknown action" }, 400, origin);
  },
};
