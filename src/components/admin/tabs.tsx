import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  CalendarOff,
  Check,
  MessageCircle,
  Pencil,
  RotateCcw,
  Scissors,
  Trash2,
  UserX,
} from "lucide-react";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useOwnerCall, useOwnerLoad } from "@/components/admin/owner-context";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ownerBlocks,
  ownerBookings,
  ownerDeleteBlock,
  ownerSaveService,
  ownerSaveSettings,
  ownerServices,
  ownerSetStatus,
  ownerSettings,
} from "@/lib/api.functions";
import { cap, formatPhone } from "@/lib/format";
import {
  addDays,
  dayLabel,
  money,
  todayKey,
  type Booking,
  type BookingStatus,
  type Service,
  type Settings,
} from "@/lib/shop";

const statusLabel: Record<BookingStatus, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Problem({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="py-12 text-center">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Button variant="outline" className="mt-4" onClick={retry}>
        Tentar de novo
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Agenda

export function AgendaTab({
  version,
  onNewBooking,
}: {
  version: number;
  onNewBooking: () => void;
}) {
  const [date, setDate] = useState(todayKey());
  const [week, setWeek] = useState(false);
  const call = useOwnerCall();
  const last = week ? addDays(date, 6) : date;

  const bookings = useOwnerLoad(
    () => ownerBookings({ data: { from: date, to: last } }),
    [date, last, version],
  );
  const blocks = useOwnerLoad(
    () => ownerBlocks({ data: { from: date, to: last } }),
    [date, last, version],
  );

  const entries = bookings.data ?? [];
  const total = entries
    .filter((b) => b.status !== "cancelado" && b.status !== "faltou")
    .reduce((sum, b) => sum + b.price, 0);

  const changeStatus = async (b: Booking, status: BookingStatus) => {
    const result = await call(ownerSetStatus({ data: { id: b.id, status } }));
    if (!result.ok) return;
    await bookings.reload();
    toast.success("Status atualizado.", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const undo = await call(ownerSetStatus({ data: { id: b.id, status: b.status } }));
          if (undo.ok) bookings.reload();
        },
      },
    });
  };

  const removeBlock = async (id: string) => {
    const result = await call(ownerDeleteBlock({ data: { id } }), {
      success: "Bloqueio removido.",
    });
    if (result.ok) blocks.reload();
  };

  return (
    <>
      <div className="metrics">
        <div className="metric">
          <span className="text-xs text-muted-foreground">Agendamentos</span>
          <strong className="metric-value">
            {entries
              .filter((b) => b.status !== "cancelado")
              .length.toString()
              .padStart(2, "0")}
          </strong>
        </div>
        <div className="metric">
          <span className="text-xs text-muted-foreground">Concluídos</span>
          <strong className="metric-value text-success">
            {entries
              .filter((b) => b.status === "concluido")
              .length.toString()
              .padStart(2, "0")}
          </strong>
        </div>
        <div className="metric">
          <span className="text-xs text-muted-foreground">Valor previsto</span>
          <strong className="metric-value text-primary">{money(total)}</strong>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-4 items-center mb-5">
        <div className="flex gap-1 items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDate(addDays(date, week ? -7 : -1))}
            aria-label="Dia anterior"
          >
            <ArrowLeft />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="text-xs">
                <CalendarDays />
                {cap(dayLabel(date, { weekday: "short", day: "numeric", month: "long" }))}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto">
              <Calendar
                mode="single"
                locale={ptBR}
                selected={new Date(date + "T12:00:00")}
                onSelect={(d) => d && setDate(keyOf(d))}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDate(addDays(date, week ? 7 : 1))}
            aria-label="Próximo dia"
          >
            <ArrowRight />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={!week ? "secondary" : "ghost"} onClick={() => setWeek(false)}>
            Dia
          </Button>
          <Button size="sm" variant={week ? "secondary" : "ghost"} onClick={() => setWeek(true)}>
            Semana
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDate(todayKey())}>
            Hoje
          </Button>
        </div>
      </div>

      {bookings.error && !bookings.data && (
        <Problem message={bookings.error} retry={bookings.reload} />
      )}
      {bookings.loading && !bookings.data && (
        <p className="text-sm text-muted-foreground py-12">Carregando agenda…</p>
      )}

      {bookings.data && !entries.length && (
        <div className="text-center py-16">
          <CalendarDays className="size-10 mx-auto text-muted-foreground" />
          <p className="text-sm mt-4 text-muted-foreground">Nenhum agendamento neste período.</p>
          <Button variant="link" onClick={onNewBooking}>
            Agendar um cliente
          </Button>
        </div>
      )}

      {entries.map((b) => (
        <div className="agenda-row" key={b.id}>
          <div>
            <strong className="font-display text-2xl text-primary">{b.time}</strong>
            {week && (
              <p className="text-[10px] text-muted-foreground">
                {dayLabel(b.date, { day: "numeric", month: "short" })}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm break-words">{b.name}</strong>
              <span className={`status ${b.status}`}>{statusLabel[b.status]}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {b.serviceName} · {money(b.price)}
            </p>
          </div>
          <div className="agenda-actions flex items-center gap-1">
            {b.status === "agendado" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Marcar como concluído"
                  aria-label={`Concluir ${b.name}`}
                  onClick={() => changeStatus(b, "concluido")}
                >
                  <Check className="text-success" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Cliente faltou"
                  aria-label={`Marcar falta ${b.name}`}
                  onClick={() => changeStatus(b, "faltou")}
                >
                  <UserX />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Cancelar agendamento"
                  aria-label={`Cancelar ${b.name}`}
                  onClick={() => changeStatus(b, "cancelado")}
                >
                  <Ban className="text-destructive" />
                </Button>
              </>
            )}
            {(b.status === "concluido" || b.status === "faltou") && (
              <Button
                variant="ghost"
                size="icon"
                title="Reabrir (voltar para agendado)"
                aria-label={`Reabrir ${b.name}`}
                onClick={() => changeStatus(b, "agendado")}
              >
                <RotateCcw />
              </Button>
            )}
          </div>
        </div>
      ))}

      {(blocks.data ?? []).map((b) => (
        <div key={b.id} className="agenda-row">
          <CalendarOff className="text-muted-foreground" />
          <div>
            <strong className="text-sm">{b.reason}</strong>
            <p className="text-xs text-muted-foreground mt-1">
              {week ? `${dayLabel(b.date, { day: "numeric", month: "short" })} · ` : ""}
              {b.start} – {b.end} · Bloqueado
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remover bloqueio ${b.reason}`}
            onClick={() => removeBlock(b.id)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Lembretes

export function RemindersTab({ version }: { version: number }) {
  const tomorrow = addDays(todayKey(), 1);
  const bookings = useOwnerLoad(
    () => ownerBookings({ data: { from: tomorrow, to: tomorrow } }),
    [tomorrow, version],
  );
  const list = (bookings.data ?? []).filter((b) => b.status === "agendado");

  return (
    <section className="mt-9">
      <h2 className="text-lg font-semibold">Lembretes de amanhã</h2>
      <p className="text-sm text-muted-foreground mt-2">
        {cap(dayLabel(tomorrow, { weekday: "long", day: "numeric", month: "long" }))}
      </p>
      {bookings.error && !bookings.data && (
        <Problem message={bookings.error} retry={bookings.reload} />
      )}
      {list.map((b) => {
        const text = `Olá, ${b.name}! Passando para lembrar do seu horário amanhã, às ${b.time}, para ${b.serviceName}, no Zé Filho Barbeiro. Para cancelar ou remarcar: ${location.origin}/agendamento/${b.token}`;
        return (
          <div key={b.id} className="agenda-row">
            <strong className="font-display text-2xl text-primary">{b.time}</strong>
            <div>
              <strong className="text-sm">{b.name}</strong>
              <p className="text-xs text-muted-foreground mt-2">
                {b.serviceName} · {formatPhone(b.phone)}
              </p>
            </div>
            <Button asChild variant="outline" className="agenda-actions">
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/55${b.phone}?text=${encodeURIComponent(text)}`}
              >
                <MessageCircle />
                Enviar lembrete
              </a>
            </Button>
          </div>
        );
      })}
      {bookings.data && !list.length && (
        <p className="text-muted-foreground text-sm py-12">Nenhum cliente agendado para amanhã.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Bloqueios

export function BlocksTab({ version }: { version: number }) {
  const call = useOwnerCall();
  const today = todayKey();
  const blocks = useOwnerLoad(
    () => ownerBlocks({ data: { from: today, to: addDays(today, 365) } }),
    [today, version],
  );
  const settings = useOwnerLoad(() => ownerSettings(), [version]);

  const remove = async (id: string) => {
    const result = await call(ownerDeleteBlock({ data: { id } }), {
      success: "Bloqueio removido.",
    });
    if (result.ok) blocks.reload();
  };

  return (
    <section className="mt-8">
      {settings.data && (
        <p className="text-sm text-muted-foreground">
          Almoço fixo: {settings.data.lunchStart} – {settings.data.lunchEnd}
        </p>
      )}
      {blocks.error && !blocks.data && <Problem message={blocks.error} retry={blocks.reload} />}
      {blocks.data && !blocks.data.length && (
        <p className="text-muted-foreground text-sm text-center py-16">
          Nenhum bloqueio adicional.
        </p>
      )}
      {(blocks.data ?? []).map((b) => (
        <div className="agenda-row" key={b.id}>
          <CalendarOff className="text-primary" />
          <div>
            <strong className="text-sm">{b.reason}</strong>
            <p className="text-xs text-muted-foreground mt-2">
              {dayLabel(b.date)} · {b.start} – {b.end}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remover bloqueio ${b.reason}`}
            onClick={() => remove(b.id)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- Serviços

export function ServicesTab({
  version,
  onEdit,
}: {
  version: number;
  onEdit: (service: Service) => void;
}) {
  const call = useOwnerCall();
  const services = useOwnerLoad(() => ownerServices(), [version]);

  const toggle = async (s: Service) => {
    const result = await call(ownerSaveService({ data: { ...s, active: !s.active } }));
    if (result.ok) services.reload();
  };

  return (
    <section className="mt-8">
      {services.error && !services.data && (
        <Problem message={services.error} retry={services.reload} />
      )}
      {(services.data ?? []).map((s) => (
        <div className="agenda-row" key={s.id}>
          <Scissors className="text-primary" />
          <div className="min-w-0">
            <strong className="text-sm">{s.name}</strong>
            <p className="text-xs text-muted-foreground mt-2">
              {money(s.price)} · {s.duration} minutos
            </p>
          </div>
          <div className="agenda-actions flex gap-2">
            <Button
              variant={s.active ? "secondary" : "outline"}
              size="sm"
              onClick={() => toggle(s)}
            >
              {s.active ? "Ativo" : "Inativo"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${s.name}`}
              onClick={() => onEdit(s)}
            >
              <Pencil />
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- Configurações

export function SettingsTab({ version }: { version: number }) {
  const call = useOwnerCall();
  const loaded = useOwnerLoad(() => ownerSettings(), [version]);
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded.data) setForm(loaded.data);
  }, [loaded.data]);

  if (loaded.error && !form) return <Problem message={loaded.error} retry={loaded.reload} />;
  if (!form) return <p className="text-sm text-muted-foreground py-12">Carregando…</p>;

  const set = (patch: Partial<Settings>) => setForm({ ...form, ...patch });
  const toggleDay = (day: number) =>
    set({
      closedDays: form.closedDays.includes(day)
        ? form.closedDays.filter((d) => d !== day)
        : [...form.closedDays, day],
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.open >= form.close || form.lunchStart >= form.lunchEnd) {
      toast.error("Confira os horários de funcionamento e almoço.");
      return;
    }
    setSaving(true);
    await call(ownerSaveSettings({ data: form }), { success: "Configurações salvas." });
    setSaving(false);
  };

  return (
    <form className="form-grid max-w-xl mt-8" onSubmit={save}>
      <label className="field-label">
        Nome da barbearia
        <Input
          value={form.name}
          required
          maxLength={80}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      <div>
        <p className="text-sm mb-3">Dias de atendimento</p>
        <div className="flex flex-wrap gap-2">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
            <Button
              key={d}
              type="button"
              variant={form.closedDays.includes(i) ? "outline" : "default"}
              size="sm"
              aria-pressed={!form.closedDays.includes(i)}
              onClick={() => toggleDay(i)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="field-label">
          Abre às
          <Input
            type="time"
            value={form.open}
            onChange={(e) => set({ open: e.target.value })}
            required
          />
        </label>
        <label className="field-label">
          Fecha às
          <Input
            type="time"
            value={form.close}
            onChange={(e) => set({ close: e.target.value })}
            required
          />
        </label>
        <label className="field-label">
          Início do almoço
          <Input
            type="time"
            value={form.lunchStart}
            onChange={(e) => set({ lunchStart: e.target.value })}
            required
          />
        </label>
        <label className="field-label">
          Fim do almoço
          <Input
            type="time"
            value={form.lunchEnd}
            onChange={(e) => set({ lunchEnd: e.target.value })}
            required
          />
        </label>
      </div>
      <label className="field-label">
        Intervalo entre clientes (minutos)
        <Input
          type="number"
          min={0}
          max={60}
          value={form.interval}
          onChange={(e) =>
            set({ interval: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })
          }
        />
      </label>
      <Button type="submit" className="justify-self-start" disabled={saving}>
        {saving ? "Salvando…" : "Salvar configurações"}
        <Check />
      </Button>
    </form>
  );
}
