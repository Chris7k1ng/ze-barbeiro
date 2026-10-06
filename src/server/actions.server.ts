import type { ZodType, ZodTypeDef } from "zod";
import {
  MAX_ACTIVE_PER_PHONE,
  MAX_ADVANCE_DAYS,
  availabilityInputSchema,
  blockInputSchema,
  bookingInputSchema,
  computeSlots,
  deleteInputSchema,
  lookupInputSchema,
  rangeInputSchema,
  rescheduleInputSchema,
  serviceInputSchema,
  setStatusInputSchema,
  settingsInputSchema,
  tokenInputSchema,
  type Busy,
} from "@/lib/booking-rules";
import {
  addDays,
  minutes,
  todayKey,
  weekdayOf,
  type Booking,
  type DayAvailability,
  type MyBooking,
  type Service,
  type Settings,
} from "@/lib/shop";
import type { Repo } from "./repo.server";
import { toMyBooking } from "./repo.server";

export type ErrorCode = "INVALID" | "CONFLICT" | "NOT_FOUND" | "UNAUTH";

/** Erro "esperado": a mensagem é mostrada para a pessoa. Qualquer outro erro vira uma mensagem genérica. */
export class UserError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = "INVALID",
  ) {
    super(message);
  }
}

function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const generic = !issue || issue.code === "invalid_type" || issue.code === "unrecognized_keys";
  throw new UserError(generic ? "Dados inválidos." : issue.message);
}

export function randomId() {
  return crypto.randomUUID();
}

/** Código secreto e impossível de adivinhar, usado no link do agendamento. */
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const startsAt = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).getTime();

export type PublicInfo = { services: Service[]; settings: Settings };

export function createActions(repo: Repo, clock: () => number = Date.now) {
  /** Calcula os horários livres de uma lista de dias, já descontando agendamentos e bloqueios. */
  async function slotsForDays(from: string, count: number, duration: number, exceptToken?: string) {
    const now = clock();
    const today = todayKey(now);
    const last = addDays(from, count - 1);
    const [settings, blocks, booked] = await Promise.all([
      repo.getSettings(),
      repo.blocksInRange(from, last),
      repo.busyInRange(from, last, exceptToken),
    ]);

    const days: DayAvailability[] = [];
    for (let i = 0; i < count; i++) {
      const date = addDays(from, i);
      if (date < today || date > addDays(today, MAX_ADVANCE_DAYS)) continue;
      const open = !settings.closedDays.includes(weekdayOf(date));
      const busy: Busy[] = booked
        .filter((b) => b.date === date)
        .map((b) => ({ start: minutes(b.time), end: minutes(b.time) + b.duration }));
      days.push({
        date,
        open,
        slots: open
          ? computeSlots({
              date,
              durationMin: duration,
              settings,
              busy,
              blocks: blocks.filter((b) => b.date === date),
              now,
            })
          : [],
      });
    }
    return days;
  }

  async function assertFree(date: string, time: string, duration: number, exceptToken?: string) {
    const [day] = await slotsForDays(date, 1, duration, exceptToken);
    if (!day?.slots.includes(time)) {
      throw new UserError("Esse horário não está mais disponível. Escolha outro.", "CONFLICT");
    }
  }

  const overlapMessage = "Esse horário acabou de ser ocupado por outro agendamento. Escolha outro.";

  async function createBooking(input: unknown, byOwner: boolean) {
    const data = parse(bookingInputSchema, input);
    const service = await repo.getService(data.serviceId);
    if (!service || !service.active) throw new UserError("Esse serviço não está disponível.");

    if (!byOwner) {
      const active = await repo.countActiveByPhone(data.phone, todayKey(clock()));
      if (active >= MAX_ACTIVE_PER_PHONE) {
        throw new UserError(
          `Este número já tem ${MAX_ACTIVE_PER_PHONE} agendamentos ativos. Cancele um deles ou fale com a barbearia.`,
        );
      }
    }
    await assertFree(data.date, data.time, service.duration);

    const booking = {
      id: randomId(),
      token: randomToken(),
      name: data.name,
      phone: data.phone,
      serviceId: service.id,
      serviceName: service.name,
      priceCents: Math.round(service.price * 100),
      duration: service.duration,
      date: data.date,
      time: data.time,
    };
    const result = await repo.insertBooking(booking);
    if (!result.ok) throw new UserError(overlapMessage, "CONFLICT");
    return booking;
  }

  async function ownBooking(token: string) {
    const booking = await repo.getBookingByToken(token);
    if (!booking) throw new UserError("Agendamento não encontrado.", "NOT_FOUND");
    return booking;
  }

  return {
    // ====================== público (cliente) ======================
    async publicInfo(): Promise<PublicInfo> {
      const [services, settings] = await Promise.all([repo.listServices(true), repo.getSettings()]);
      return { services, settings };
    },

    async availability(input: unknown): Promise<DayAvailability[]> {
      const data = parse(availabilityInputSchema, input);
      let duration: number;
      if (data.token) {
        const booking = await ownBooking(data.token);
        if (booking.status !== "agendado")
          throw new UserError("Este agendamento não pode mais ser remarcado.");
        duration = booking.duration;
      } else {
        const service = await repo.getService(data.serviceId!);
        if (!service || !service.active) throw new UserError("Esse serviço não está disponível.");
        duration = service.duration;
      }
      return slotsForDays(data.from, data.days, duration, data.token);
    },

    async createBooking(input: unknown): Promise<MyBooking> {
      const b = await createBooking(input, false);
      return {
        token: b.token,
        name: b.name,
        serviceName: b.serviceName,
        price: b.priceCents / 100,
        duration: b.duration,
        date: b.date,
        time: b.time,
        status: "agendado",
      };
    },

    async myBooking(input: unknown): Promise<MyBooking | null> {
      const { token } = parse(tokenInputSchema, input);
      const booking = await repo.getBookingByToken(token);
      return booking ? toMyBooking(booking) : null;
    },

    async cancel(input: unknown) {
      const { token } = parse(tokenInputSchema, input);
      const booking = await ownBooking(token);
      if (booking.status !== "agendado")
        throw new UserError("Este agendamento não pode mais ser cancelado.");
      if (startsAt(booking.date, booking.time) <= clock())
        throw new UserError("Esse horário já passou.");
      await repo.cancelByToken(token);
    },

    async reschedule(input: unknown): Promise<MyBooking> {
      const { token, date, time } = parse(rescheduleInputSchema, input);
      const booking = await ownBooking(token);
      if (booking.status !== "agendado")
        throw new UserError("Este agendamento não pode mais ser remarcado.");
      if (startsAt(booking.date, booking.time) <= clock())
        throw new UserError("Esse horário já passou.");
      await assertFree(date, time, booking.duration, token);
      const result = await repo.rescheduleByToken(token, date, time);
      if (!result.ok) throw new UserError(overlapMessage, "CONFLICT");
      return { ...toMyBooking(booking), date, time };
    },

    /** Só mostra data, hora e serviço dos próximos horários: nunca nome, id nem o link privado. */
    async lookup(input: unknown) {
      const { phone } = parse(lookupInputSchema, input);
      const now = clock();
      const rows = await repo.upcomingByPhone(phone, todayKey(now));
      return rows
        .filter((b) => startsAt(b.date, b.time) > now)
        .map((b) => ({ serviceName: b.serviceName, date: b.date, time: b.time }));
    },

    // ====================== painel do dono ======================
    async adminBookings(input: unknown): Promise<Booking[]> {
      const { from, to } = parse(rangeInputSchema, input);
      return repo.bookingsInRange(from, to);
    },

    async adminSetStatus(input: unknown) {
      const { id, status } = parse(setStatusInputSchema, input);
      const result = await repo.setStatus(id, status);
      if (!result.ok) {
        throw result.reason === "overlap"
          ? new UserError("Esse horário já foi ocupado por outro agendamento.", "CONFLICT")
          : new UserError("Agendamento não encontrado.", "NOT_FOUND");
      }
    },

    async adminCreateBooking(input: unknown): Promise<Booking> {
      const b = await createBooking(input, true);
      return {
        id: b.id,
        token: b.token,
        name: b.name,
        phone: b.phone,
        serviceId: b.serviceId,
        serviceName: b.serviceName,
        price: b.priceCents / 100,
        duration: b.duration,
        date: b.date,
        time: b.time,
        status: "agendado",
      };
    },

    async adminBlocks(input: unknown) {
      const { from, to } = parse(rangeInputSchema, input);
      return repo.blocksInRange(from, to);
    },

    async adminAddBlock(input: unknown) {
      const b = parse(blockInputSchema, input);
      await repo.addBlock({
        id: randomId(),
        date: b.date,
        start: b.start,
        end: b.end,
        reason: b.reason || "Compromisso",
      });
    },

    async adminDeleteBlock(input: unknown) {
      const { id } = parse(deleteInputSchema, input);
      await repo.deleteBlock(id);
    },

    async adminServices() {
      return repo.listServices(false);
    },

    async adminSaveService(input: unknown) {
      const s = parse(serviceInputSchema, input);
      await repo.saveService({
        id: s.id ?? randomId(),
        name: s.name,
        description: s.description || "Cuidado e acabamento no seu estilo.",
        price: s.price,
        duration: s.duration,
        active: s.active,
        photo: s.photo || undefined,
      });
    },

    async adminSettings() {
      return repo.getSettings();
    },

    async adminSaveSettings(input: unknown) {
      await repo.saveSettings(parse(settingsInputSchema, input));
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
