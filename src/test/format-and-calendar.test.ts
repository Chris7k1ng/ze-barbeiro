import { describe, it, expect } from "vitest";
import { formatPhone, phoneDigits } from "@/lib/format";
import { buildIcs, googleCalendarUrl } from "@/lib/calendar-links";

describe("Máscara de telefone", () => {
  it("formata aos poucos enquanto digita", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("8")).toBe("(8");
    expect(formatPhone("85")).toBe("(85");
    expect(formatPhone("859")).toBe("(85) 9");
    expect(formatPhone("8599999")).toBe("(85) 99999");
    expect(formatPhone("85999990001")).toBe("(85) 99999-0001");
  });
  it("guarda só dígitos, no máximo 11", () => {
    expect(phoneDigits("(85) 99999-0001 99")).toBe("85999990001");
  });
});

describe("Calendário", () => {
  const event = {
    title: "Corte - Zé Filho",
    date: "2099-10-05",
    time: "10:30",
    durationMinutes: 60,
    description: "Teste, com vírgula",
  };
  it("converte o horário de Fortaleza (UTC-3) para UTC", () => {
    const ics = buildIcs(event, "abc");
    expect(ics).toContain("DTSTART:20991005T133000Z");
    expect(ics).toContain("DTEND:20991005T143000Z");
    expect(ics).toContain("DESCRIPTION:Teste\\, com vírgula");
  });
  it("gera link do Google Agenda com início e fim", () => {
    const url = googleCalendarUrl(event);
    expect(url).toContain("calendar.google.com");
    expect(decodeURIComponent(url)).toContain("20991005T133000Z/20991005T143000Z");
  });
});
