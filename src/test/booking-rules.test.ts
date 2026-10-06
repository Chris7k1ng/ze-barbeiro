import { describe, expect, it } from "vitest";
import { computeSlots } from "@/lib/booking-rules";
import type { Settings } from "@/lib/shop";

const settings: Settings = {
  name: "Teste",
  open: "09:00",
  close: "19:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  interval: 0,
  closedDays: [0],
};
// quinta-feira, 12:00 no Ceará
const now = Date.parse("2099-10-01T12:00:00-03:00");
const slots = (over: Partial<Parameters<typeof computeSlots>[0]> = {}) =>
  computeSlots({
    date: "2099-10-05",
    durationMin: 60,
    settings,
    busy: [],
    blocks: [],
    now,
    ...over,
  });

describe("horários livres", () => {
  it("não abre aos domingos", () => {
    expect(slots({ date: "2099-10-04" })).toEqual([]);
  });

  it("o serviço inteiro precisa caber antes do almoço e do fechamento", () => {
    const list = slots();
    expect(list).toContain("11:00");
    expect(list).not.toContain("11:30");
    expect(list).not.toContain("12:00");
    expect(list).toContain("13:00");
    expect(list).toContain("18:00");
    expect(list).not.toContain("18:30");
  });

  it("serviço curto cabe em horários que o longo não cabe", () => {
    expect(slots({ durationMin: 30 })).toContain("11:30");
  });

  it("desconta agendamentos e bloqueios", () => {
    const list = slots({
      durationMin: 30,
      busy: [{ start: 10 * 60, end: 11 * 60 }],
      blocks: [{ start: "14:00", end: "15:00" }],
    });
    expect(list).not.toContain("10:00");
    expect(list).not.toContain("10:30");
    expect(list).toContain("11:00");
    expect(list).not.toContain("14:00");
    expect(list).not.toContain("14:30");
    expect(list).toContain("15:00");
  });

  it("respeita o intervalo entre clientes", () => {
    const list = slots({
      durationMin: 30,
      settings: { ...settings, interval: 15 },
      busy: [{ start: 10 * 60, end: 10 * 60 + 30 }],
    });
    expect(list).not.toContain("10:30"); // 10:30 ainda está dentro da folga de 15 min
    expect(list).toContain("11:00");
  });

  it("não oferece horários que já passaram nem datas fora do prazo", () => {
    expect(
      slots({ date: "2099-10-01", now: Date.parse("2099-10-01T15:10:00-03:00") }),
    ).not.toContain("15:00");
    expect(slots({ date: "2099-10-01", now: Date.parse("2099-10-01T15:10:00-03:00") })).toContain(
      "16:00",
    );
    expect(slots({ date: "2099-09-30" })).toEqual([]);
    expect(slots({ date: "2099-12-30" })).toEqual([]);
  });
});
