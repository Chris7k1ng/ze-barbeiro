import { useEffect, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { useOwnerCall } from "@/components/admin/owner-context";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getAvailability,
  getPublicInfo,
  ownerAddBlock,
  ownerCreateBooking,
  ownerSaveService,
} from "@/lib/api.functions";
import { formatPhone, phoneDigits } from "@/lib/format";
import { dayLabel, money, todayKey, type Service } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Common = { open: boolean; onClose: () => void; onSaved: () => void };

function DayField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return (
    <label className="field-label">
      Dia
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="justify-start">
            <CalendarDays />
            {dayLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={new Date(value + "T12:00:00")}
            onSelect={(d) => d && onChange(keyOf(d))}
            disabled={{ before: new Date(todayKey() + "T00:00:00") }}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </label>
  );
}

// ---------------------------------------------------------------- agendar cliente

export function BookingDialog({
  open,
  onClose,
  onSaved,
  defaultDate,
}: Common & { defaultDate: string }) {
  const call = useOwnerCall();
  const info = useLoad(() => getPublicInfo(), []);
  const services = info.data?.services ?? [];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setDate(defaultDate < todayKey() ? todayKey() : defaultDate);
      setTime("");
      setError("");
    }
  }, [open, defaultDate]);

  useEffect(() => {
    if (!serviceId && services[0]) setServiceId(services[0].id);
  }, [services, serviceId]);

  const availability = useLoad(
    () =>
      serviceId
        ? getAvailability({ data: { serviceId, from: date, days: 1 } })
        : Promise.resolve({ ok: true as const, data: [] }),
    [serviceId, date, open],
  );
  const slots = availability.data?.[0]?.slots ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2 || !/^[1-9]{2}9\d{8}$/.test(phone))
      return setError("Informe nome e WhatsApp válido com DDD.");
    if (!slots.includes(time)) return setError("Escolha um horário disponível.");
    setBusy(true);
    const result = await call(
      ownerCreateBooking({ data: { name, phone, serviceId, date, time } }),
      {
        success: "Agendamento salvo.",
        onError: (message) => {
          setError(message);
          availability.reload();
        },
      },
    );
    setBusy(false);
    if (result.ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>Agendar cliente</DialogTitle>
        <DialogDescription>
          O horário fica salvo no banco de dados e sai da lista dos clientes.
        </DialogDescription>
        <form className="form-grid" onSubmit={submit}>
          <label className="field-label">
            Nome do cliente
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
          <label className="field-label">
            WhatsApp com DDD
            <Input
              type="tel"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(phoneDigits(e.target.value))}
              placeholder="(85) 99999-9999"
              required
            />
          </label>
          <label className="field-label">
            Serviço
            <select
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setTime("");
              }}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {money(s.price)}
                </option>
              ))}
            </select>
          </label>
          <DayField
            value={date}
            onChange={(d) => {
              setDate(d);
              setTime("");
            }}
          />
          <label className="field-label">
            Horário
            <select value={time} onChange={(e) => setTime(e.target.value)} required>
              <option value="">Selecione um horário</option>
              {slots.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {!availability.loading && !slots.length && (
              <span className="text-xs text-destructive">
                Nenhum horário livre. Escolha outro dia.
              </span>
            )}
          </label>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11" disabled={busy}>
            {busy ? "Salvando…" : "Confirmar agendamento"}
            <Check />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- bloquear horário

export function BlockDialog({
  open,
  onClose,
  onSaved,
  defaultDate,
}: Common & { defaultDate: string }) {
  const call = useOwnerCall();
  const [date, setDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(defaultDate < todayKey() ? todayKey() : defaultDate);
      setAllDay(false);
      setStart("12:00");
      setEnd("13:00");
      setReason("");
      setError("");
    }
  }, [open, defaultDate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!allDay && (!start || !end || end <= start)) return setError("Informe um período válido.");
    setBusy(true);
    const result = await call(
      ownerAddBlock({
        data: { date, start: allDay ? "00:00" : start, end: allDay ? "23:59" : end, reason },
      }),
      { success: "Bloqueio salvo.", onError: setError },
    );
    setBusy(false);
    if (result.ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>Bloquear horário</DialogTitle>
        <DialogDescription>
          Os clientes não conseguem agendar dentro do período bloqueado.
        </DialogDescription>
        <form className="form-grid" onSubmit={submit}>
          <DayField value={date} onChange={setDate} />
          <label className="flex gap-2 items-center text-sm">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Bloquear o dia inteiro
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <label className="field-label">
                Início
                <Input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Fim
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </label>
            </div>
          )}
          <label className="field-label">
            Motivo
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Almoço, compromisso, folga…"
              maxLength={80}
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
            <Check />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- serviço (novo ou editar)

export function ServiceDialog({
  open,
  onClose,
  onSaved,
  service,
}: Common & { service: Service | null }) {
  const call = useOwnerCall();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("35");
  const [duration, setDuration] = useState("30");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(service?.name ?? "");
      setDescription(service?.description ?? "");
      setPrice(String(service?.price ?? 35));
      setDuration(String(service?.duration ?? 30));
      setPhoto(service?.photo ?? "");
      setError("");
    }
  }, [open, service]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !(Number(price) > 0) || !(Number(duration) >= 5)) {
      return setError("Informe nome, valor e duração válidos.");
    }
    setBusy(true);
    const result = await call(
      ownerSaveService({
        data: {
          id: service?.id,
          name,
          description,
          price: Number(price),
          duration: Number(duration),
          active: service?.active ?? true,
          photo: photo.trim() || undefined,
        },
      }),
      { success: "Serviço salvo.", onError: setError },
    );
    setBusy(false);
    if (result.ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
        <DialogDescription>
          Mudar o preço não altera o valor dos atendimentos que já foram marcados.
        </DialogDescription>
        <form className="form-grid" onSubmit={submit}>
          <label className="field-label">
            Nome do serviço
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
          <label className="field-label">
            Descrição (aparece para o cliente)
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="field-label">
              Preço (R$)
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Duração (min)
              <Input
                type="number"
                min={5}
                max={480}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="field-label">
            Foto (opcional)
            <Input
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              placeholder="/servicos/corte.jpg  ou  https://…"
            />
            <span className="text-[11px] text-muted-foreground">
              Use uma foto sua: coloque o arquivo na pasta public/servicos e escreva o caminho
              acima.
            </span>
          </label>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
            <Check />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
