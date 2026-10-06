// Login do painel do dono: uma senha (variável ADMIN_PASSWORD) e um cookie assinado.
// Usa só a Web Crypto, que existe tanto no Node quanto no Cloudflare.

export const SESSION_COOKIE = "zf_admin";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação que leva o mesmo tempo para qualquer texto (evita descobrir a senha pelo tempo de resposta). */
function sameText(a: string, b: string) {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function passwordMatches(input: string, expected: string) {
  // compara as "impressões digitais" para o tamanho da senha não vazar
  const [a, b] = await Promise.all([hmacHex("senha", input), hmacHex("senha", expected)]);
  return sameText(a, b);
}

export async function createSessionValue(secret: string, now = Date.now()) {
  const expires = now + SESSION_SECONDS * 1000;
  return `${expires}.${await hmacHex(secret, String(expires))}`;
}

export async function sessionIsValid(secret: string, value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < now) return false;
  return sameText(signature, await hmacHex(secret, expires));
}

// Limite de tentativas de senha por endereço (guardado na memória do servidor: protege de tentativas
// em sequência, mas não substitui uma senha forte).
const attempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

export function loginBlocked(key: string, now = Date.now()) {
  const entry = attempts.get(key);
  return !!entry && entry.blockedUntil > now;
}

export function registerLoginFailure(key: string, now = Date.now()) {
  const entry = attempts.get(key) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    entry.count = 0;
  }
  attempts.set(key, entry);
}

export function registerLoginSuccess(key: string) {
  attempts.delete(key);
}
