import type { Db, Row } from "./db.server";
import type { Block, Booking, BookingStatus, MyBooking, Service, Settings } from "@/lib/shop";

// Todas as consultas SQL do sistema ficam aqui. Datas e horários saem do banco já como texto
// ("AAAA-MM-DD" / "HH24:MI") para não depender de como cada driver converte DATE e TIME.

const EXCLUSION_VIOLATION = "23P01";
const isOverlapError = (error: unknown) =>
  (error as { code?: string } | null)?.code === EXCLUSION_VIOLATION;

const BOOKING_COLUMNS = `id, token, nome_cliente, telefone, servico_id, servico_nome, preco_centavos, duracao_min,
  to_char(data, 'YYYY-MM-DD') AS dia, to_char(horario, 'HH24:MI') AS hora, status`;

const toBooking = (r: Row): Booking => ({
  id: r.id,
  token: r.token,
  name: r.nome_cliente,
  phone: r.telefone,
  serviceId: r.servico_id ?? null,
  serviceName: r.servico_nome,
  price: Number(r.preco_centavos) / 100,
  duration: Number(r.duracao_min),
  date: r.dia,
  time: r.hora,
  status: r.status as BookingStatus,
});

export const toMyBooking = (b: Booking): MyBooking => ({
  token: b.token,
  name: b.name,
  serviceName: b.serviceName,
  price: b.price,
  duration: b.duration,
  date: b.date,
  time: b.time,
  status: b.status,
});

const toService = (r: Row): Service => ({
  id: r.id,
  name: r.nome,
  description: r.descricao,
  price: Number(r.preco_centavos) / 100,
  duration: Number(r.duracao_min),
  active: Boolean(r.ativo),
  photo: r.foto || undefined,
});

export type NewBooking = {
  id: string;
  token: string;
  name: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  duration: number;
  date: string;
  time: string;
};

export type WriteResult = { ok: true } | { ok: false; reason: "overlap" | "missing" };

export function createRepo(db: Db) {
  return {
    // ---------- configurações ----------
    async getSettings(): Promise<Settings> {
      const [r] = await db.query(
        `SELECT nome, to_char(abre, 'HH24:MI') AS abre, to_char(fecha, 'HH24:MI') AS fecha,
                to_char(almoco_inicio, 'HH24:MI') AS almoco_inicio, to_char(almoco_fim, 'HH24:MI') AS almoco_fim,
                intervalo_min, dias_fechados
           FROM configuracoes WHERE id = 1`,
      );
      if (!r) throw new Error("Configurações não encontradas no banco.");
      return {
        name: r.nome,
        open: r.abre,
        close: r.fecha,
        lunchStart: r.almoco_inicio,
        lunchEnd: r.almoco_fim,
        interval: Number(r.intervalo_min),
        closedDays: String(r.dias_fechados).split(",").filter(Boolean).map(Number),
      };
    },

    async saveSettings(s: Settings) {
      await db.query(
        `UPDATE configuracoes SET nome = $1, abre = $2::time, fecha = $3::time, almoco_inicio = $4::time,
                almoco_fim = $5::time, intervalo_min = $6, dias_fechados = $7 WHERE id = 1`,
        [
          s.name,
          s.open,
          s.close,
          s.lunchStart,
          s.lunchEnd,
          s.interval,
          [...new Set(s.closedDays)].sort().join(","),
        ],
      );
    },

    // ---------- serviços ----------
    async listServices(onlyActive: boolean): Promise<Service[]> {
      const rows = await db.query(
        `SELECT id, nome, descricao, preco_centavos, duracao_min, ativo, foto
           FROM servicos ${onlyActive ? "WHERE ativo" : ""} ORDER BY ordem, criado_em, id`,
      );
      return rows.map(toService);
    },

    async getService(id: string): Promise<Service | null> {
      const [r] = await db.query(
        `SELECT id, nome, descricao, preco_centavos, duracao_min, ativo, foto FROM servicos WHERE id = $1`,
        [id],
      );
      return r ? toService(r) : null;
    },

    async saveService(s: Service) {
      await db.query(
        `INSERT INTO servicos (id, nome, descricao, preco_centavos, duracao_min, ativo, foto, ordem)
         VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM servicos))
         ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
           preco_centavos = EXCLUDED.preco_centavos, duracao_min = EXCLUDED.duracao_min,
           ativo = EXCLUDED.ativo, foto = EXCLUDED.foto`,
        [
          s.id,
          s.name,
          s.description,
          Math.round(s.price * 100),
          s.duration,
          s.active,
          s.photo ?? null,
        ],
      );
    },

    // ---------- bloqueios ----------
    async blocksInRange(from: string, to: string): Promise<Block[]> {
      const rows = await db.query(
        `SELECT id, to_char(data, 'YYYY-MM-DD') AS dia, to_char(inicio, 'HH24:MI') AS inicio,
                to_char(fim, 'HH24:MI') AS fim, motivo
           FROM bloqueios WHERE data BETWEEN $1::date AND $2::date ORDER BY data, inicio`,
        [from, to],
      );
      return rows.map((r) => ({
        id: r.id,
        date: r.dia,
        start: r.inicio,
        end: r.fim,
        reason: r.motivo,
      }));
    },

    async addBlock(b: Block) {
      await db.query(
        `INSERT INTO bloqueios (id, data, inicio, fim, motivo) VALUES ($1, $2::date, $3::time, $4::time, $5)`,
        [b.id, b.date, b.start, b.end, b.reason],
      );
    },

    async deleteBlock(id: string) {
      await db.query(`DELETE FROM bloqueios WHERE id = $1`, [id]);
    },

    // ---------- agendamentos ----------
    /** Horários já ocupados no período (sem dados de clientes). `exceptToken` ignora um agendamento (ao remarcar). */
    async busyInRange(from: string, to: string, exceptToken?: string) {
      const rows = await db.query(
        `SELECT to_char(data, 'YYYY-MM-DD') AS dia, to_char(horario, 'HH24:MI') AS hora, duracao_min
           FROM agendamentos
          WHERE data BETWEEN $1::date AND $2::date AND status <> 'cancelado'
            AND ($3::text IS NULL OR token <> $3::text)`,
        [from, to, exceptToken ?? null],
      );
      return rows.map((r) => ({
        date: r.dia as string,
        time: r.hora as string,
        duration: Number(r.duracao_min),
      }));
    },

    async countActiveByPhone(phone: string, fromDate: string) {
      const [r] = await db.query(
        `SELECT count(*)::int AS n FROM agendamentos WHERE telefone = $1 AND status = 'agendado' AND data >= $2::date`,
        [phone, fromDate],
      );
      return Number(r?.n ?? 0);
    },

    async insertBooking(b: NewBooking): Promise<WriteResult> {
      try {
        await db.query(
          `INSERT INTO agendamentos (id, token, nome_cliente, telefone, servico_id, servico_nome,
                                     preco_centavos, duracao_min, data, horario)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::time)`,
          [
            b.id,
            b.token,
            b.name,
            b.phone,
            b.serviceId,
            b.serviceName,
            b.priceCents,
            b.duration,
            b.date,
            b.time,
          ],
        );
        return { ok: true };
      } catch (error) {
        if (isOverlapError(error)) return { ok: false, reason: "overlap" };
        throw error;
      }
    },

    async getBookingByToken(token: string): Promise<Booking | null> {
      const [r] = await db.query(`SELECT ${BOOKING_COLUMNS} FROM agendamentos WHERE token = $1`, [
        token,
      ]);
      return r ? toBooking(r) : null;
    },

    async bookingsInRange(from: string, to: string): Promise<Booking[]> {
      const rows = await db.query(
        `SELECT ${BOOKING_COLUMNS} FROM agendamentos
          WHERE data BETWEEN $1::date AND $2::date ORDER BY data, horario`,
        [from, to],
      );
      return rows.map(toBooking);
    },

    async upcomingByPhone(phone: string, fromDate: string): Promise<Booking[]> {
      const rows = await db.query(
        `SELECT ${BOOKING_COLUMNS} FROM agendamentos
          WHERE telefone = $1 AND status = 'agendado' AND data >= $2::date ORDER BY data, horario LIMIT 20`,
        [phone, fromDate],
      );
      return rows.map(toBooking);
    },

    async setStatus(id: string, status: BookingStatus): Promise<WriteResult> {
      try {
        const rows = await db.query(
          `UPDATE agendamentos SET status = $2, atualizado_em = now() WHERE id = $1 RETURNING id`,
          [id, status],
        );
        return rows.length ? { ok: true } : { ok: false, reason: "missing" };
      } catch (error) {
        if (isOverlapError(error)) return { ok: false, reason: "overlap" };
        throw error;
      }
    },

    async cancelByToken(token: string): Promise<WriteResult> {
      const rows = await db.query(
        `UPDATE agendamentos SET status = 'cancelado', atualizado_em = now()
          WHERE token = $1 AND status = 'agendado' RETURNING id`,
        [token],
      );
      return rows.length ? { ok: true } : { ok: false, reason: "missing" };
    },

    async rescheduleByToken(token: string, date: string, time: string): Promise<WriteResult> {
      try {
        const rows = await db.query(
          `UPDATE agendamentos SET data = $2::date, horario = $3::time, atualizado_em = now()
            WHERE token = $1 AND status = 'agendado' RETURNING id`,
          [token, date, time],
        );
        return rows.length ? { ok: true } : { ok: false, reason: "missing" };
      } catch (error) {
        if (isOverlapError(error)) return { ok: false, reason: "overlap" };
        throw error;
      }
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
export type { MyBooking };
