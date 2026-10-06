// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createSessionValue,
  loginBlocked,
  passwordMatches,
  registerLoginFailure,
  registerLoginSuccess,
  sessionIsValid,
} from "@/server/auth.server";

describe("login do painel", () => {
  it("confere a senha", async () => {
    expect(await passwordMatches("segredo123", "segredo123")).toBe(true);
    expect(await passwordMatches("segredo124", "segredo123")).toBe(false);
    expect(await passwordMatches("", "segredo123")).toBe(false);
  });

  it("aceita o cookie válido e recusa vencido, adulterado ou de outra senha", async () => {
    const now = Date.now();
    const value = await createSessionValue("chave", now);
    expect(await sessionIsValid("chave", value, now + 1000)).toBe(true);
    expect(await sessionIsValid("chave", value, now + 8 * 24 * 3600 * 1000)).toBe(false);
    expect(await sessionIsValid("outra-chave", value, now + 1000)).toBe(false);
    const [expires, signature] = value.split(".");
    expect(await sessionIsValid("chave", `${Number(expires) + 99999}.${signature}`, now)).toBe(
      false,
    );
    expect(await sessionIsValid("chave", undefined)).toBe(false);
    expect(await sessionIsValid("chave", "lixo")).toBe(false);
  });

  it("bloqueia depois de 5 senhas erradas e libera depois do prazo", () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) registerLoginFailure("1.2.3.4", now);
    expect(loginBlocked("1.2.3.4", now + 1000)).toBe(true);
    expect(loginBlocked("1.2.3.4", now + 16 * 60 * 1000)).toBe(false);
    expect(loginBlocked("5.6.7.8", now)).toBe(false);
    registerLoginSuccess("1.2.3.4");
  });
});
