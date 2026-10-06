import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MessageCircle, Search } from "lucide-react";
import { BrandFooter, BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupBookings } from "@/lib/api.functions";
import { formatPhone, phoneDigits } from "@/lib/format";
import { whatsappUrl } from "@/lib/shop-info";
import { dayLabel } from "@/lib/shop";

export const Route = createFileRoute("/meu-agendamento")({
  head: () => ({
    meta: [
      { title: "Meu horário | Zé Filho Barbeiro" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MyBookings,
});

type Found = Array<{ serviceName: string; date: string; time: string }>;

function MyBookings() {
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResults(null);
    if (!/^[1-9]{2}9\d{8}$/.test(phone)) return setError("Informe um WhatsApp válido com DDD.");
    setLoading(true);
    try {
      const result = await lookupBookings({ data: { phone } });
      if (result.ok) setResults(result.data);
      else setError(result.error);
    } catch {
      setError("Não foi possível consultar agora. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  };

  const help = whatsappUrl("Olá! Preciso remarcar ou cancelar meu horário.");

  return (
    <>
      <BrandHeader />
      <main className="shell">
        <div className="confirmation">
          <div className="confirm-icon">
            <Search className="size-8" />
          </div>
          <p className="eyebrow">Meu horário</p>
          <h1 className="section-title mt-3">Consulte seu horário</h1>
          <p className="text-sm text-muted-foreground mt-3">
            Digite o WhatsApp usado no agendamento.
          </p>
          <form onSubmit={search} className="mt-7 space-y-3">
            <Input
              value={formatPhone(phone)}
              onChange={(e) => setPhone(phoneDigits(e.target.value))}
              placeholder="(85) 99999-9999"
              type="tel"
              inputMode="tel"
              className="h-12"
            />
            <Button className="w-full h-12" disabled={loading}>
              {loading ? "Consultando…" : "Consultar horário"}
              <ArrowRight />
            </Button>
          </form>
          {error && (
            <p role="alert" className="text-destructive text-sm mt-4">
              {error}
            </p>
          )}

          {results && results.length > 0 && (
            <div className="mt-8 space-y-3">
              {results.map((b, i) => (
                <div key={i} className="border border-border rounded-md px-4 py-4">
                  <strong>{b.serviceName}</strong>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dayLabel(b.date, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
                    {b.time}
                  </p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                Para remarcar ou cancelar, use o link que você recebeu ao agendar
                {help ? " ou chame a barbearia no WhatsApp." : "."}
              </p>
              {help && (
                <Button asChild variant="outline" className="w-full h-11">
                  <a href={help} target="_blank" rel="noreferrer">
                    <MessageCircle />
                    Falar no WhatsApp
                  </a>
                </Button>
              )}
            </div>
          )}
          {results && results.length === 0 && (
            <p className="text-sm text-muted-foreground mt-6">
              Nenhum horário futuro encontrado para este WhatsApp.
            </p>
          )}

          <Button asChild variant="ghost" className="mt-6">
            <Link to="/">
              Agendar um novo horário
              <CalendarDays />
            </Link>
          </Button>
        </div>
      </main>
      <BrandFooter />
    </>
  );
}
