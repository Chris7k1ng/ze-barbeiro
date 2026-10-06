import { z } from "zod";
import { addDays, clock, minutes, todayKey, weekdayOf, type Settings } from "@/lib/shop";

// ---------- regras do negócio (usadas pelo servidor, que é quem decide) ----------

/** de quanto em quanto tempo começa um horário na agenda */
export const SLOT_STEP_MIN = 30;
/** até quantos dias à frente o cliente consegue agendar */
export const MAX_ADVANCE_DAYS = 60;
/** quantos agendamentos futuros o mesmo telefone pode ter ao mesmo tempo */
export const MAX_ACTIVE_PER_PHONE = 3;

export type Busy = { start: number; end: number };
export type BlockRange = { start: string; end: string };

type SlotInput = {
  date: string;
  durationMin: number;
  settings: Settings;
  /** agendamentos já marcados naquele dia (em minutos desde 00:00) */
  busy: Busy[];
  blocks: BlockRange[];
  now?: number;
};

/** Lista os horários livres de um dia para um serviço com a duração informada. */
export function computeSlots({
  date,
  durationMin,
  settings,
  busy,
  blocks,
  now = Date.now(),
}: SlotInput): string[] {
  const today = todayKey(now);
  if (date < today || date > addDays(today, MAX_ADVANCE_DAYS)) return [];
  if (settings.closedDays.includes(weekdayOf(date))) return [];

  const taken: Array<[number, number]> = [
    [minutes(settings.lunchStart), minutes(settings.lunchEnd)],
    ...blocks.map((b): [number, number] => [minutes(b.start), minutes(b.end)]),
    ...busy.map((b): [number, number] => [b.start, b.end + settings.interval]),
  ];

  const slots: string[] = [];
  for (
    let start = minutes(settings.open);
    start + durationMin <= minutes(settings.close);
    start += SLOT_STEP_MIN
  ) {
    if (new Date(`${date}T${clock(start)}:00-03:00`).getTime() <= now) continue;
    const end = start + durationMin + settings.interval;
    if (taken.some(([a, b]) => start < b && end > a)) continue;
    slots.push(clock(start));
  }
  return slots;
}

// ---------- validação dos dados que chegam de fora ----------

const isRealDate = (value: string) => {
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine(isRealDate, "Data inválida.");

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^[1-9]{2}9\d{8}$/, "Informe um WhatsApp válido com DDD."));

const nameSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(2, "Informe seu nome.")
      .max(80, "O nome está muito longo.")
      // eslint-disable-next-line no-control-regex
      .refine((v) => !/[\u0000-\u001f]/.test(v), "Nome inválido."),
  );

const idSchema = z.string().min(1).max(80);
const tokenSchema = z.string().min(20).max(200);

export const bookingInputSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  serviceId: idSchema,
  date: dateSchema,
  time: timeSchema,
});

/** Informe o serviço (novo agendamento) ou o token (remarcar um agendamento existente). */
export const availabilityInputSchema = z
  .object({
    serviceId: idSchema.optional(),
    token: tokenSchema.optional(),
    from: dateSchema,
    days: z.number().int().min(1).max(31),
  })
  .refine((o) => o.serviceId || o.token, "Informe o serviço.");

export const tokenInputSchema = z.object({ token: tokenSchema });
export const rescheduleInputSchema = z.object({
  token: tokenSchema,
  date: dateSchema,
  time: timeSchema,
});
export const lookupInputSchema = z.object({ phone: phoneSchema });

export const statusSchema = z.enum(["agendado", "concluido", "faltou", "cancelado"]);
export const setStatusInputSchema = z.object({ id: idSchema, status: statusSchema });
export const rangeInputSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((r) => r.from <= r.to, "Período inválido.")
  .refine(
    (r) => new Date(r.to).getTime() - new Date(r.from).getTime() <= 400 * 86_400_000,
    "Período muito grande.",
  );

export const blockInputSchema = z
  .object({
    date: dateSchema,
    start: timeSchema,
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido."),
    reason: z.string().trim().max(80).default(""),
  })
  .refine((b) => b.end > b.start, "O fim do bloqueio precisa ser depois do início.");

export const deleteInputSchema = z.object({ id: idSchema });

const photoSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || /^(https:\/\/|\/)/.test(v),
    "A foto precisa ser um link https:// ou um arquivo da pasta public.",
  )
  .optional();

export const serviceInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Informe o nome do serviço.").max(80),
  description: z.string().trim().max(200).default(""),
  price: z.number().min(0.01, "Informe um valor válido.").max(10000),
  duration: z.number().int().min(5, "A duração mínima é 5 minutos.").max(480),
  active: z.boolean().default(true),
  photo: photoSchema,
});

export const settingsInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    open: timeSchema,
    close: timeSchema,
    lunchStart: timeSchema,
    lunchEnd: timeSchema,
    interval: z.number().int().min(0).max(60),
    closedDays: z.array(z.number().int().min(0).max(6)).max(7),
  })
  .refine((s) => s.open < s.close, "O horário de abertura precisa ser antes do fechamento.")
  .refine((s) => s.lunchStart < s.lunchEnd, "O início do almoço precisa ser antes do fim.");

export const adminLoginSchema = z.object({ password: z.string().min(1).max(200) });
