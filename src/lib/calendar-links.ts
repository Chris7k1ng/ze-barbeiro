import { shopInfo } from "@/lib/shop-info";

type CalendarEvent = {
  title: string;
  date: string; // AAAA-MM-DD (horário de Fortaleza)
  time: string; // HH:MM
  durationMinutes: number;
  description?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

// Fortaleza fica em UTC-3 o ano todo (sem horário de verão).
function eventRange({ date, time, durationMinutes }: CalendarEvent) {
  const start = new Date(`${date}T${time}:00-03:00`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Link para adicionar o horário no Google Agenda. */
export function googleCalendarUrl(event: CalendarEvent) {
  const { start, end } = eventRange(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: event.description ?? "",
    location: shopInfo.address,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const escapeIcs = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

/** Conteúdo de um arquivo .ics (iPhone, Android, Outlook...) com alarme 1h antes. */
export function buildIcs(event: CalendarEvent, uid: string) {
  const { start, end } = eventRange(event);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ze Filho Barbeiro//Agendamento//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}@zefilhobarbeiro`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description ?? "")}`,
    `LOCATION:${escapeIcs(shopInfo.address)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Seu horário na barbearia é daqui a 1 hora",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Baixa o arquivo .ics no aparelho da pessoa. */
export function downloadIcs(event: CalendarEvent, uid: string) {
  const blob = new Blob([buildIcs(event, uid)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "horario-ze-filho-barbeiro.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
