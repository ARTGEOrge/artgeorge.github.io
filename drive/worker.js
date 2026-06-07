/**
 * ARTGEOrge Drive — cross-device backend (Cloudflare Worker)
 * ==========================================================
 * Accounts + file metadata in D1; file contents in KV. Same emailed
 * 6-digit code on sign-in. Replaces the old mailer-only worker.
 *
 * Bindings the Worker needs (Settings → Bindings):
 *   D1 database  → variable name  DB      (any database)
 *   KV namespace → variable name  FILES   (any namespace)
 *
 * Variables / secrets (Settings → Variables and Secrets):
 *   RESEND_API_KEY  (secret)  your Resend key (re_...)
 *   CODE_SECRET     (secret)  long random string; signs codes + sessions
 *   MAIL_FROM                 "ARTGEOrge Drive <onboarding@resend.dev>"
 *   ALLOW_ORIGIN             https://artgeorge.github.io   (* while testing)
 *
 * Tables are auto-created on first request — no SQL console step needed.
 * Files are capped at 25 MB each (KV value limit). To email people other
 * than your own Resend account address, verify a domain and update MAIL_FROM.
 */

const CODE_TTL_MS = 10 * 60 * 1000;          // verification code lifetime
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FILE = 25 * 1024 * 1024;            // 25 MB per file (KV limit)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let schemaReady = false;

// ---------- helpers ----------
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session",
  };
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}
function toHex(buf) { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function fromHex(h) { const b = new Uint8Array(h.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }
function randomHex(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return toHex(b); }
function genId() { return "n" + randomHex(9); }
function genCode() {
  const b = new Uint8Array(4); crypto.getRandomValues(b);
  const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  return String(n % 1000000).padStart(6, "0");
}
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return toHex(sig);
}
async function hashPw(pw, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(saltHex), iterations: 120000, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}
function eq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

async function makeSession(env, email) {
  const exp = Date.now() + SESSION_TTL_MS;
  const sig = await hmacHex(env.CODE_SECRET, `S|${email}|${exp}`);
  return `${btoa(email)}.${exp}.${sig}`;
}
async function readSession(env, token) {
  if (!token) return null;
  const p = String(token).split(".");
  if (p.length !== 3) return null;
  let email; try { email = atob(p[0]); } catch { return null; }
  const exp = parseInt(p[1], 10);
  if (!exp || Date.now() > exp) return null;
  const sig = await hmacHex(env.CODE_SECRET, `S|${email}|${exp}`);
  return eq(sig, p[2]) ? email : null;
}

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, salt TEXT NOT NULL, pw_hash TEXT NOT NULL, created INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, parent_id TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, mime TEXT, size INTEGER DEFAULT 0, created INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_nodes_owner_parent ON nodes(owner, parent_id)").run();
  schemaReady = true;
}

function emailHtml(code) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;
    background:#1c1726;color:#e8eaed;border-radius:14px;padding:28px;border:1px solid #2b2238">
    <div style="font-size:22px;font-weight:800"><span style="color:#a78bfa">ARTGEOrge</span> Drive</div>
    <p style="color:#b8b2c6">Here is your sign-in code:</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#cdbcff;
      background:#241d33;border-radius:10px;padding:16px;text-align:center;margin:14px 0">${code}</div>
    <p style="color:#8b8595;font-size:13px">This code expires in 10 minutes.
      If you didn't request it, you can ignore this email.</p></div>`;
}
async function sendEmail(env, to, code) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM, to: [to],
      subject: `Your ARTGEOrge Drive code: ${code}`,
      html: emailHtml(code),
      text: `Your ARTGEOrge Drive verification code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!r.ok) throw new Error("resend " + r.status + ": " + (await r.text()));
}
async function startCode(env, origin, email) {
  const code = genCode();
  const exp = Date.now() + CODE_TTL_MS;
  const sig = await hmacHex(env.CODE_SECRET, `${email}|${exp}|${code}`);
  try { await sendEmail(env, email, code); }
  catch (e) { return { err: json({ ok: false, error: "emailfail", detail: String(e.message || e) }, 502, origin) }; }
  return { token: `${exp}.${sig}` };
}

// ---------- auth handlers ----------
async function handleSignup(env, origin, email, password) {
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "bademail" }, 400, origin);
  if (!password || password.length < 6) return json({ ok: false, error: "weakpw" }, 400, origin);
  const existing = await env.DB.prepare("SELECT email FROM users WHERE email=?").bind(email).first();
  if (existing) return json({ ok: false, error: "exists" }, 409, origin);
  const r = await startCode(env, origin, email);
  if (r.err) return r.err;
  const salt = randomHex(16);
  const hash = await hashPw(password, salt);
  await env.DB.prepare("INSERT INTO users (email,salt,pw_hash,created) VALUES (?,?,?,?)").bind(email, salt, hash, Date.now()).run();
  return json({ ok: true, token: r.token }, 200, origin);
}
async function handleSignin(env, origin, email, password) {
  const u = await env.DB.prepare("SELECT salt, pw_hash FROM users WHERE email=?").bind(email).first();
  if (!u) return json({ ok: false, error: "nouser" }, 404, origin);
  const hash = await hashPw(password || "", u.salt);
  if (!eq(hash, u.pw_hash)) return json({ ok: false, error: "badpw" }, 401, origin);
  const r = await startCode(env, origin, email);
  if (r.err) return r.err;
  return json({ ok: true, token: r.token }, 200, origin);
}
async function handleVerify(env, origin, email, code, token) {
  const dot = (token || "").indexOf(".");
  if (dot < 0) return json({ ok: false, error: "badtoken" }, 400, origin);
  const exp = parseInt(token.slice(0, dot), 10);
  const sig = token.slice(dot + 1);
  if (!exp || Date.now() > exp) return json({ ok: false, error: "expired" }, 200, origin);
  const expect = await hmacHex(env.CODE_SECRET, `${email}|${exp}|${(code || "").replace(/\D/g, "")}`);
  if (!eq(expect, sig)) return json({ ok: false, error: "badcode" }, 200, origin);
  const u = await env.DB.prepare("SELECT email FROM users WHERE email=?").bind(email).first();
  if (!u) return json({ ok: false, error: "nouser" }, 404, origin);
  const session = await makeSession(env, email);
  return json({ ok: true, session }, 200, origin);
}

// ---------- file/folder handlers ----------
const SELECT_COLS = "id, parent_id AS parentId, type, name, mime, size, created";

async function handleList(env, origin, owner, parentId) {
  const rows = (await env.DB.prepare(`SELECT ${SELECT_COLS} FROM nodes WHERE owner=? AND parent_id=?`).bind(owner, parentId).all()).results || [];
  return json({ ok: true, nodes: rows }, 200, origin);
}
async function handleSearch(env, origin, owner, q) {
  const like = "%" + String(q).replace(/[%_]/g, "") + "%";
  const rows = (await env.DB.prepare(`SELECT ${SELECT_COLS} FROM nodes WHERE owner=? AND name LIKE ? LIMIT 200`).bind(owner, like).all()).results || [];
  return json({ ok: true, nodes: rows }, 200, origin);
}
async function handleRecent(env, origin, owner) {
  const rows = (await env.DB.prepare(`SELECT ${SELECT_COLS} FROM nodes WHERE owner=? AND type='file' ORDER BY created DESC LIMIT 50`).bind(owner).all()).results || [];
  return json({ ok: true, nodes: rows }, 200, origin);
}
async function handleMkdir(env, origin, owner, parentId, name) {
  const id = genId(); const created = Date.now();
  await env.DB.prepare("INSERT INTO nodes (id,owner,parent_id,type,name,mime,size,created) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, owner, parentId, "folder", String(name).slice(0, 200), "", 0, created).run();
  return json({ ok: true, node: { id, parentId, type: "folder", name, mime: "", size: 0, created } }, 200, origin);
}
async function handleRename(env, origin, owner, id, name) {
  if (!id || !name) return json({ ok: false, error: "badargs" }, 400, origin);
  await env.DB.prepare("UPDATE nodes SET name=? WHERE id=? AND owner=?").bind(String(name).slice(0, 200), id, owner).run();
  return json({ ok: true }, 200, origin);
}
async function handleDelete(env, origin, owner, id) {
  if (!id) return json({ ok: false, error: "badargs" }, 400, origin);
  // collect the node + all descendants
  const ids = [id];
  let frontier = [id];
  while (frontier.length) {
    const ph = frontier.map(() => "?").join(",");
    const rows = (await env.DB.prepare(`SELECT id FROM nodes WHERE owner=? AND parent_id IN (${ph})`).bind(owner, ...frontier).all()).results || [];
    frontier = rows.map((r) => r.id);
    ids.push(...frontier);
  }
  for (const nid of ids) { await env.FILES.delete(`blob:${owner}:${nid}`); }
  const ph = ids.map(() => "?").join(",");
  await env.DB.prepare(`DELETE FROM nodes WHERE owner=? AND id IN (${ph})`).bind(owner, ...ids).run();
  return json({ ok: true }, 200, origin);
}
async function handleUsage(env, origin, owner) {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(size),0) AS total, COUNT(*) AS files FROM nodes WHERE owner=? AND type='file'").bind(owner).first();
  return json({ ok: true, total: r.total || 0, files: r.files || 0 }, 200, origin);
}
async function handleUpload(env, origin, req, url) {
  const s = req.headers.get("X-Session") || url.searchParams.get("s");
  const owner = await readSession(env, s);
  if (!owner) return json({ ok: false, error: "auth" }, 401, origin);
  const parentId = url.searchParams.get("parentId") || "root";
  const name = (url.searchParams.get("name") || "file").slice(0, 200);
  const mime = url.searchParams.get("mime") || "";
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_FILE) return json({ ok: false, error: "toolarge" }, 413, origin);
  const id = genId(); const created = Date.now();
  await env.FILES.put(`blob:${owner}:${id}`, buf);
  await env.DB.prepare("INSERT INTO nodes (id,owner,parent_id,type,name,mime,size,created) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, owner, parentId, "file", name, mime, buf.byteLength, created).run();
  return json({ ok: true, node: { id, parentId, type: "file", name, mime, size: buf.byteLength, created } }, 200, origin);
}
async function handleDownload(env, origin, url) {
  const owner = await readSession(env, url.searchParams.get("s"));
  const id = url.searchParams.get("id");
  if (!owner) return new Response("auth", { status: 401, headers: corsHeaders(origin) });
  const node = await env.DB.prepare("SELECT name, mime FROM nodes WHERE id=? AND owner=?").bind(id, owner).first();
  if (!node) return new Response("not found", { status: 404, headers: corsHeaders(origin) });
  const data = await env.FILES.get(`blob:${owner}:${id}`, "arrayBuffer");
  if (!data) return new Response("no data", { status: 404, headers: corsHeaders(origin) });
  return new Response(data, {
    headers: { ...corsHeaders(origin), "Content-Type": node.mime || "application/octet-stream", "Cache-Control": "private, max-age=60" },
  });
}

// ---------- router ----------
export default {
  async fetch(req, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
    if (!env.DB || !env.FILES) return json({ ok: false, error: "notconfigured", detail: "Bind D1 as DB and KV as FILES." }, 500, origin);
    try { await ensureSchema(env); } catch (e) { return json({ ok: false, error: "db", detail: String(e.message || e) }, 500, origin); }

    if (url.pathname === "/download" && req.method === "GET") return handleDownload(env, origin, url);
    if (url.pathname === "/upload" && req.method === "POST") return handleUpload(env, origin, req, url);

    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405, origin);
    let body; try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400, origin); }
    const action = body.action;
    const email = (body.email || "").trim().toLowerCase();

    if (action === "signup") return handleSignup(env, origin, email, body.password);
    if (action === "signin") return handleSignin(env, origin, email, body.password);
    if (action === "verify") return handleVerify(env, origin, email, body.code, body.token);

    const owner = await readSession(env, body.session);
    if (!owner) return json({ ok: false, error: "auth" }, 401, origin);
    if (action === "list") return handleList(env, origin, owner, body.parentId || "root");
    if (action === "search") return handleSearch(env, origin, owner, body.q || "");
    if (action === "recent") return handleRecent(env, origin, owner);
    if (action === "mkdir") return handleMkdir(env, origin, owner, body.parentId || "root", body.name || "Untitled folder");
    if (action === "rename") return handleRename(env, origin, owner, body.id, body.name);
    if (action === "del") return handleDelete(env, origin, owner, body.id);
    if (action === "usage") return handleUsage(env, origin, owner);
    return json({ ok: false, error: "unknown action" }, 400, origin);
  },
};
