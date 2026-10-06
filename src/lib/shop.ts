// Tipos e funções de data usados tanto pelo servidor quanto pelas telas.
// Todas as datas são "AAAA-MM-DD" e os horários "HH:MM" no fuso do Ceará (UTC-3, sem horário de verão).

export type Service = {
  id: string;
  name: string;
  description: string;
  /** preço em reais (ex.: 35 ou 27.5) */
  price: number;
  /** duração em minutos */
  duration: number;
  active: boolean;
  photo?: string | undefined;
};

export type BookingStatus = "agendado" | "concluido" | "faltou" | "cancelado";

/** Agendamento como o dono vê no painel. O preço e o nome do serviço são os da hora do agendamento. */
export type Booking = {
  id: string;
  token: string;
  name: string;
  phone: string;
  serviceId: string | null;
  serviceName: string;
  price: number;
  duration: number;
  date: string;
  time: string;
  status: BookingStatus;
};

export type Block = { id: string; date: string; start: string; end: string; reason: string };

export type Settings = {
  name: string;
  open: string;
  close: string;
  lunchStart: string;
  lunchEnd: string;
  /** folga em minutos entre um cliente e outro */
  interval: number;
  /** 0 = domingo ... 6 = sábado */
  closedDays: number[];
};

/** O que o cliente pode ver do próprio agendamento (sem telefone). */
export type MyBooking = {
  token: string;
  name: string;
  serviceName: string;
  price: number;
  duration: number;
  date: string;
  time: string;
  status: BookingStatus;
};

export type DayAvailability = { date: string; open: boolean; slots: string[] };

export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function todayKey(now: number = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function addDays(key: string, days: number) {
  const date = new Date(key + "T12:00:00-03:00");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayOf(key: string) {
  return new Date(key + "T12:00:00-03:00").getUTCDay();
}

export function dayLabel(
  key: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Date(key + "T12:00:00-03:00").toLocaleDateString("pt-BR", {
    ...options,
    timeZone: "America/Fortaleza",
  });
}

export const minutes = (value: string) => {
  const [h = 0, m = 0] = value.split(":").map(Number);
  return h * 60 + m;
};

export const clock = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
