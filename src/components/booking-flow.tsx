import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { BrandFooter, BrandHeader } from "@/components/brand-header";
import { DateTimePicker } from "@/components/date-time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBooking } from "@/lib/api.functions";
import barberPortrait from "@/assets/foto.png";
import hero from "@/assets/barbershop.jpg";
import { downloadIcs, googleCalendarUrl } from "@/lib/calendar-links";
import { cap, formatPhone, phoneDigits } from "@/lib/format";
import { mapsUrl, shopInfo, whatsappUrl } from "@/lib/shop-info";
import { dayLabel, money, type MyBooking, type Service, type Settings } from "@/lib/shop";

const steps = ["Serviço", "Dia e horário", "Seus dados", "Confirmação"];
const weekdayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "segunda a sábado", "terça, quinta e sábado"... */
function openDaysText(closedDays: number[]) {
  const open = [0, 1, 2, 3, 4, 5, 6].filter((d) => !closedDays.includes(d));
  if (!open.length) return "Fechado";
  const first = open[0]!;
  const last = open[open.length - 1]!;
  if (open.length > 2 && last - first + 1 === open.length)
    return `${cap(weekdayNames[first]!)} a ${weekdayNames[last]}`;
  const names = open.map((d) => weekdayNames[d]!);
  return cap(names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0]!);
}

const hourText = (value: string) => value.replace(":00", "h").replace(":", "h");

function ServicePhoto({ service }: { service: Service }) {
  const [failed, setFailed] = useState(false);
  if (!service.photo || failed) {
    return (
      <span className="service-photo service-photo-fallback" aria-hidden="true">
        <Scissors />
      </span>
    );
  }
  return (
    <span className="service-photo">
      <img src={service.photo} alt={service.name} loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

export function BookingFlow({ services, settings }: { services: Service[]; settings: Settings }) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<MyBooking | null>(null);
  const [pickerVersion, setPickerVersion] = useState(0);

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".feature-strip, #agendamento, .service-option, .summary, .page-footer",
      ),
    );
    targets.forEach((el) => el.classList.add("reveal-on-scroll"));
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const service = services.find((s) => s.id === serviceId);

  const finish = async () => {
    if (!service || !date || !time || saving) return;
    if (name.trim().length < 2) return setError("Informe seu nome.");
    if (!/^[1-9]{2}9\d{8}$/.test(phone))
      return setError("Informe um WhatsApp válido com DDD e 9 dígitos.");

    setSaving(true);
    setError("");
    try {
      const result = await createBooking({ data: { name, phone, serviceId, date, time } });
      if (result.ok) {
        setDone(result.data);
        setStep(3);
        return;
      }
      setError(result.error);
      if (result.code === "CONFLICT") {
        // o horário foi ocupado enquanto a pessoa preenchia: volta e atualiza a lista
        setTime("");
        setStep(1);
        setPickerVersion((v) => v + 1);
      }
    } catch {
      setError("Não foi possível salvar seu agendamento. Verifique sua internet e tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/agendamento/${token}`);
      toast.success("Link do agendamento copiado.");
    } catch {
      toast.error(
        'Não foi possível copiar. Use o botão "Ver meu agendamento" e copie o endereço da página.',
      );
    }
  };

  const startOver = () => {
    setDone(null);
    setStep(0);
    setServiceId("");
    setDate("");
    setTime("");
    setName("");
    setPhone("");
  };

  if (done) {
    const day = dayLabel(done.date, { weekday: "long", day: "numeric", month: "long" });
    const event = {
      title: `${done.serviceName} - Zé Filho Barbeiro`,
      date: done.date,
      time: done.time,
      durationMinutes: done.duration,
      description: `Agendamento de ${done.name}. Para cancelar ou remarcar: ${location.origin}/agendamento/${done.token}`,
    };
    const wa = whatsappUrl(
      `Olá! Acabei de agendar ${done.serviceName} para ${day} às ${done.time}. Meu nome é ${done.name}.`,
    );
    return (
      <>
        <BrandHeader />
        <div className="shell">
          <div className="confirmation">
            <div className="confirm-icon">
              <Check className="size-8" />
            </div>
            <p className="eyebrow">Tudo certo</p>
            <h1 className="section-title mt-3">Seu horário está reservado!</h1>
            <p className="text-muted-foreground text-sm mt-3">
              {done.name.split(" ")[0]}, esperamos você para dar um trato no visual.
            </p>
            <div className="mt-8">
              <div className="detail-row">
                <span className="text-muted-foreground">Serviço</span>
                <strong>{done.serviceName}</strong>
              </div>
              <div className="detail-row">
                <span className="text-muted-foreground">Dia</span>
                <strong>
                  {dayLabel(done.date, { weekday: "short", day: "numeric", month: "long" })}
                </strong>
              </div>
              <div className="detail-row">
                <span className="text-muted-foreground">Horário</span>
                <strong>{done.time}</strong>
              </div>
              <div className="detail-row">
                <span className="text-muted-foreground">Valor</span>
                <strong className="text-primary">{money(done.price)}</strong>
              </div>
            </div>
            <p className="text-xs text-muted-foreground my-6">
              Guarde o link do seu agendamento: é por ele que você consulta, remarca ou cancela o
              horário.
            </p>
            <Button asChild className="w-full h-12">
              <Link to="/agendamento/$token" params={{ token: done.token }}>
                Ver meu agendamento
                <ArrowRight />
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button asChild variant="outline" className="h-11">
                <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
                  <CalendarDays />
                  Google Agenda
                </a>
              </Button>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => downloadIcs(event, done.token.slice(0, 24))}
              >
                <CalendarDays />
                iPhone / outros
              </Button>
            </div>
            {wa && (
              <Button asChild variant="outline" className="w-full mt-3 h-11">
                <a href={wa} target="_blank" rel="noreferrer">
                  <MessageCircle />
                  Avisar a barbearia no WhatsApp
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full mt-3 h-11"
              onClick={() => copyLink(done.token)}
            >
              Copiar link do agendamento
            </Button>
            <Button variant="ghost" className="mt-4" onClick={startOver}>
              Fazer outro agendamento
            </Button>
          </div>
        </div>
        <BrandFooter />
      </>
    );
  }

  const maps = mapsUrl();

  return (
    <>
      <BrandHeader />
      <section id="inicio" className="hero">
        <img
          className="hero-image"
          src={hero}
          alt="Interior elegante da barbearia"
          width={1536}
          height={768}
        />
        <div className="hero-portrait-wrap" aria-hidden="true">
          <img className="hero-portrait" src={barberPortrait} alt="" />
        </div>
        <div className="hero-brush brush-one" />
        <div className="hero-brush brush-two" />
        <div className="shell hero-content">
          <p className="eyebrow flex items-center gap-3">
            <span className="w-8 h-px bg-primary" />
            Seu estilo. Nosso cuidado.
          </p>
          <h1 className="hero-title display">
            Zé Filho Barbeiro
            <br />
            <span>Seu próximo corte.</span>
          </h1>
          <p className="text-base text-foreground/80 mt-6 max-w-[510px] leading-relaxed">
            Mais que um corte, é autoestima.
            <br />
            Aqui você encontra qualidade, bom atendimento e o estilo que combina com você.
          </p>
          <a href="#agendamento" className="hero-cta mt-7">
            <CalendarDays className="size-5" />
            Agendar meu horário
            <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      <section className="feature-strip" aria-label="Diferenciais">
        <div>
          <span>
            <Scissors />
          </span>
          <p>
            Cortes modernos<small>para todos os estilos</small>
          </p>
        </div>
        <div>
          <span>
            <User />
          </span>
          <p>
            Barba feita<small>com precisão</small>
          </p>
        </div>
        <div>
          <span>
            <Clock />
          </span>
          <p>
            Atendimento rápido<small>e personalizado</small>
          </p>
        </div>
        <div>
          <span>
            <Sparkles />
          </span>
          <p>
            Qualidade e confiança<small>em cada detalhe</small>
          </p>
        </div>
      </section>

      <main id="agendamento" className="shell">
        <div className="stepper">
          {steps.map((label, i) => (
            <div key={label} className={`step-item ${i <= step ? "active" : ""}`}>
              <span className="step-number">
                {i < step ? <Check className="size-3" /> : String(i + 1).padStart(2, "0")}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="booking-layout">
          <section id="servicos" className="min-w-0">
            <p className="eyebrow">Passo {String(step + 1).padStart(2, "0")} de 04</p>
            <h2 className="section-title mt-2">
              {step === 0
                ? "O que vamos fazer hoje?"
                : step === 1
                  ? "Quando vamos te receber?"
                  : "Vamos nos conhecer?"}
            </h2>
            <p className="text-muted-foreground text-xs mt-2">
              {step === 0
                ? "Escolha o cuidado que combina com você."
                : step === 1
                  ? "Escolha o melhor dia e um horário disponível."
                  : "Só precisamos do seu nome e WhatsApp."}
            </p>

            {step === 0 && (
              <div className="service-list">
                {services.map((s) => (
                  <Button
                    variant="ghost"
                    key={s.id}
                    className={`service-option ${serviceId === s.id ? "selected" : ""}`}
                    onClick={() => {
                      setServiceId(s.id);
                      setDate("");
                      setTime("");
                    }}
                    aria-pressed={serviceId === s.id}
                  >
                    <ServicePhoto service={s} />
                    <span className="min-w-0">
                      <span className="text-sm font-semibold block">
                        {s.name}
                        {s.name.includes("+") && (
                          <span className="text-[8px] text-primary border border-primary/30 ml-2 px-1 py-0.5 align-middle">
                            COMBO
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal block mt-1.5 leading-relaxed">
                        {s.description}
                      </span>
                      <span className="flex gap-3 items-center mt-3">
                        <span className="text-primary text-sm font-semibold">{money(s.price)}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {s.duration} min
                        </span>
                      </span>
                    </span>
                    <span className="selection-dot">
                      {serviceId === s.id && <Check className="size-3" />}
                    </span>
                  </Button>
                ))}
                {!services.length && (
                  <p className="text-sm text-muted-foreground py-8">
                    Nenhum serviço disponível no momento.
                  </p>
                )}
              </div>
            )}

            {step === 1 && (
              <DateTimePicker
                serviceId={serviceId}
                date={date}
                time={time}
                version={pickerVersion}
                onChange={(d, t) => {
                  setDate(d);
                  setTime(t);
                }}
              />
            )}

            {step === 2 && (
              <form
                id="booking-details"
                className="form-grid mt-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  finish();
                }}
              >
                <label className="field-label">
                  Nome
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    autoComplete="name"
                    className="h-12"
                    maxLength={80}
                  />
                </label>
                <label className="field-label">
                  WhatsApp com DDD
                  <Input
                    value={formatPhone(phone)}
                    onChange={(e) => setPhone(phoneDigits(e.target.value))}
                    placeholder="(85) 99999-9999"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    className="h-12"
                  />
                </label>
                <p className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <ShieldCheck className="size-4 shrink-0 text-primary" />
                  Seu contato é usado apenas para informações do seu agendamento.
                </p>
              </form>
            )}

            {error && (
              <p role="alert" className="text-destructive text-sm mt-5">
                {error}
              </p>
            )}
            <div className="flex justify-between items-center mt-7 gap-3">
              {step > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  <ArrowLeft />
                  Voltar
                </Button>
              ) : (
                <span className="text-[10px] text-muted-foreground flex gap-2 items-center">
                  <ShieldCheck className="size-3" />
                  Sem precisar de cadastro
                </span>
              )}
              <Button
                className="h-11 px-6"
                disabled={saving || (step === 0 ? !service : step === 1 ? !date || !time : false)}
                onClick={() => (step === 2 ? finish() : setStep(step + 1))}
              >
                {step === 2 ? (saving ? "Salvando…" : "Confirmar agendamento") : "Continuar"}
                <ArrowRight />
              </Button>
            </div>
          </section>

          <aside className="summary">
            <div className="flex items-center gap-2 pb-5 border-b border-border">
              <CalendarDays className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Seu agendamento</h3>
            </div>
            <div className="summary-line mt-2">
              <span className="summary-label">Profissional</span>
              <span>Zé Filho</span>
            </div>
            <div className="summary-line">
              <span className="summary-label">Serviço</span>
              <span>{service?.name ?? "A escolher"}</span>
            </div>
            <div className="summary-line">
              <span className="summary-label">Duração</span>
              <span>{service ? `${service.duration} minutos` : "—"}</span>
            </div>
            <div className="summary-line">
              <span className="summary-label">Dia</span>
              <span>
                {date ? dayLabel(date, { day: "numeric", month: "short" }) : "A escolher"}
              </span>
            </div>
            <div className="summary-line">
              <span className="summary-label">Horário</span>
              <span>{time || "A escolher"}</span>
            </div>
            <div className="border-t border-border mt-3 pt-5 flex justify-between items-center">
              <span className="text-sm">Total</span>
              <strong className="text-primary text-xl">
                {service ? money(service.price) : "—"}
              </strong>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">Pagamento na barbearia.</p>
            <div className="border-t border-border mt-6 pt-5 flex gap-2">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Seu horário reservado.
                <br />
                Seu estilo em boas mãos.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <section id="sobre" className="shell about">
        <p className="eyebrow">Sobre a barbearia</p>
        <h2 className="section-title mt-2">Estilo e tradição desde 2021</h2>
        <p className="text-sm text-muted-foreground mt-4 max-w-xl leading-relaxed">
          Mais que um corte, é autoestima. Aqui você encontra qualidade, bom atendimento e o estilo
          que combina com você.
        </p>
        <div className="mt-6 max-w-xl">
          <div className="detail-row">
            <span className="text-muted-foreground flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Atendimento
            </span>
            <strong className="text-right">
              {openDaysText(settings.closedDays)}, {hourText(settings.open)} às{" "}
              {hourText(settings.close)}
            </strong>
          </div>
          {shopInfo.address && (
            <div className="detail-row">
              <span className="text-muted-foreground flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                Endereço
              </span>
              <a
                className="text-right font-semibold hover:text-primary"
                href={maps ?? undefined}
                target="_blank"
                rel="noreferrer"
              >
                {shopInfo.address}
              </a>
            </div>
          )}
        </div>
      </section>
      <BrandFooter />
    </>
  );
}
