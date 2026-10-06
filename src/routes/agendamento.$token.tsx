import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import { BrandFooter, BrandHeader } from "@/components/brand-header";
import { DateTimePicker } from "@/components/date-time-picker";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cancelMyBooking, getMyBooking, rescheduleMyBooking } from "@/lib/api.functions";
import { dayLabel, money, type MyBooking } from "@/lib/shop";

export const Route = createFileRoute("/agendamento/$token")({
  loader: ({ params }) => getMyBooking({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Meu agendamento | Zé Filho Barbeiro" },
      {
        name: "description",
        content: "Confira, remarque ou cancele seu horário no Zé Filho Barbeiro.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Meu agendamento | Zé Filho Barbeiro" },
      { property: "og:description", content: "Gerencie seu horário na barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageBooking,
});

const statusText = {
  agendado: "Confirmado",
  cancelado: "Cancelado",
  concluido: "Concluído",
  faltou: "Não compareceu",
} as const;

function ManageBooking() {
  const { token } = Route.useParams();
  const loaded = Route.useLoaderData();
  const [booking, setBooking] = useState<MyBooking | null | undefined>(
    loaded.ok ? loaded.data : undefined,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  if (!loaded.ok) return <ServiceUnavailable message={loaded.error} />;

  const cancel = async () => {
    setBusy(true);
    try {
      const result = await cancelMyBooking({ data: { token } });
      if (result.ok) {
        setBooking((b) => (b ? { ...b, status: "cancelado" } : b));
        toast.success("Agendamento cancelado.");
      } else {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  };

  const reschedule = async () => {
    if (!newDate || !newTime) return;
    setBusy(true);
    try {
      const result = await rescheduleMyBooking({ data: { token, date: newDate, time: newTime } });
      if (result.ok) {
        setBooking(result.data);
        setRescheduling(false);
        toast.success("Horário remarcado.");
      } else {
        toast.error(result.error);
        setNewTime("");
        setVersion((v) => v + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  if (rescheduling && booking) {
    return (
      <>
        <BrandHeader />
        <main className="shell">
          <div className="confirmation text-left">
            <p className="eyebrow">Remarcar</p>
            <h1 className="section-title mt-2">Escolha o novo horário</h1>
            <p className="text-xs text-muted-foreground mt-2">
              {booking.serviceName} · agora marcado para {dayLabel(booking.date)} às {booking.time}.
            </p>
            <DateTimePicker
              token={token}
              date={newDate}
              time={newTime}
              version={version}
              onChange={(d, t) => {
                setNewDate(d);
                setNewTime(t);
              }}
            />
            <div className="flex justify-between items-center mt-7 gap-3">
              <Button variant="ghost" onClick={() => setRescheduling(false)}>
                Voltar
              </Button>
              <Button
                className="h-11 px-6"
                disabled={!newDate || !newTime || busy}
                onClick={reschedule}
              >
                {busy ? "Salvando…" : "Confirmar novo horário"}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </main>
        <BrandFooter />
      </>
    );
  }

  return (
    <>
      <BrandHeader />
      <main className="shell">
        <div className="confirmation">
          {!booking ? (
            <>
              <h1 className="section-title">Agendamento não encontrado</h1>
              <p className="text-sm text-muted-foreground mt-4">
                Confira se o link está completo. Ele é o que você recebeu quando fez o agendamento.
              </p>
              <Button asChild className="mt-6">
                <Link to="/">
                  Agendar um horário
                  <ArrowRight />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="confirm-icon">
                {booking.status === "cancelado" ? <X /> : <CalendarDays />}
              </div>
              <p className="eyebrow">Seu agendamento</p>
              <h1 className="section-title mt-3">
                {booking.status === "cancelado"
                  ? "Horário cancelado"
                  : `Tudo pronto, ${booking.name.split(" ")[0]}.`}
              </h1>
              <span className={`status ${booking.status} mt-4`}>{statusText[booking.status]}</span>
              <div className="mt-6">
                <div className="detail-row">
                  <span className="text-muted-foreground">Serviço</span>
                  <strong>{booking.serviceName}</strong>
                </div>
                <div className="detail-row">
                  <span className="text-muted-foreground">Dia e horário</span>
                  <strong>
                    {dayLabel(booking.date)} · {booking.time}
                  </strong>
                </div>
                <div className="detail-row">
                  <span className="text-muted-foreground">Valor</span>
                  <strong className="text-primary">{money(booking.price)}</strong>
                </div>
                <div className="detail-row">
                  <span className="text-muted-foreground">Cliente</span>
                  <strong>{booking.name}</strong>
                </div>
              </div>
              {booking.status === "agendado" && (
                <div className="grid gap-3 mt-6">
                  <Button onClick={() => setRescheduling(true)} className="h-12">
                    Remarcar horário
                    <CalendarDays />
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                    Cancelar agendamento
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <BrandFooter />
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogTitle>Cancelar seu agendamento?</DialogTitle>
          <DialogDescription>
            O horário ficará disponível novamente. Você pode agendar outro quando quiser.
          </DialogDescription>
          <Button variant="destructive" disabled={busy} onClick={cancel}>
            Sim, cancelar
          </Button>
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>
            Manter meu horário
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
