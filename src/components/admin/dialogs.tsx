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
import { servicePhotoOptions } from "@/lib/service-photos";
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
  const [serviceIds, setServiceIds] = useState<string[]>([]);
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

  // começa com o primeiro serviço marcado; o dono pode marcar mais de um
  useEffect(() => {
    if (!serviceIds.length && services[0]) setServiceIds([services[0].id]);
  }, [services, serviceIds]);

  const toggleService = (id: string) => {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setTime("");
  };
  const chosen = services.filter((s) => serviceIds.includes(s.id));

  const availability = useLoad(
    () =>
      serviceIds.length
        ? getAvailability({ data: { serviceIds, from: date, days: 1 } })
        : Promise.resolve({ ok: true as const, data: [] }),
    [serviceIds.join(","), date, open],
  );
  const slots = availability.data?.[0]?.slots ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2 || !/^[1-9]{2}9\d{8}$/.test(phone))
      return setError("Informe nome e WhatsApp válido com DDD.");
    if (!serviceIds.length) return setError("Marque ao menos um serviço.");
    if (!slots.includes(time)) return setError("Escolha um horário disponível.");
    setBusy(true);
    const result = await call(
      ownerCreateBooking({ data: { name, phone, serviceIds, date, time } }),
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
          <fieldset className="field-label">
            <legend className="mb-2">Serviços (marque um ou mais)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs ${serviceIds.includes(s.id) ? "border-primary" : "border-border"}`}
                >
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-muted-foreground">{money(s.price)}</span>
                </label>
              ))}
            </div>
            {chosen.length > 1 && (
              <span className="text-[11px] text-muted-foreground">
                Total: {money(chosen.reduce((sum, s) => sum + s.price, 0))} ·{" "}
                {chosen.reduce((sum, s) => sum + s.duration, 0)} min
              </span>
            )}
          </fieldset>
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
          <div className="field-label">
            Foto do serviço
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <button
                type="button"
                onClick={() => setPhoto("")}
                aria-pressed={!photo}
                className={`rounded-md border p-1 text-[10px] leading-tight ${!photo ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
              >
                <span className="grid h-12 place-items-center">Automática</span>
              </button>
              {servicePhotoOptions.map((o) => (
                <button
                  type="button"
                  key={o.src}
                  onClick={() => setPhoto(o.src)}
                  aria-pressed={photo === o.src}
                  title={o.label}
                  className={`rounded-md border p-1 text-[10px] leading-tight ${photo === o.src ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  <img src={o.src} alt={o.label} className="h-12 w-full rounded object-cover" />
                  <span className="mt-1 block truncate">{o.label}</span>
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">
              Toque em uma foto para escolher. "Automática" usa a foto que combina com o nome do
              serviço.
            </span>
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">Usar outra foto (avançado)</summary>
              <Input
                className="mt-2"
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                placeholder="/servicos/minha-foto.jpg  ou  https://…"
              />
              <p className="mt-1">
                Coloque o arquivo na pasta public/servicos do projeto e escreva o caminho acima.
              </p>
            </details>
          </div>
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
