import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cap } from "@/lib/format";
import { useOwnerLoad } from "@/components/admin/owner-context";
import { ownerBookings } from "@/lib/api.functions";
import { dayLabel, money, todayKey, type Booking } from "@/lib/shop";

// ---------- datas (mês no formato "AAAA-MM") ----------

const currentMonth = () => todayKey().slice(0, 7);

function shiftMonth(month: string, delta: number) {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}

const monthName = (month: string) =>
  cap(dayLabel(`${month}-01`, { month: "long", year: "numeric" }));
const monthShort = (month: string) =>
  cap(dayLabel(`${month}-01`, { month: "short" }).replace(".", ""));

const compactMoney = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  });

// ---------- cálculos ----------

function monthStats(bookings: Booking[], month: string) {
  // usa o preço gravado no agendamento: mudar o preço do serviço depois não altera o passado
  const priceOf = (b: Booking) => b.price;
  const today = todayKey();
  const inMonth = bookings.filter((b) => b.date.slice(0, 7) === month);
  const done = inMonth.filter((b) => b.status === "concluido");
  const scheduled = inMonth.filter((b) => b.status === "agendado");
  const upcoming = scheduled.filter((b) => b.date >= today);

  const byDay = Array.from({ length: daysInMonth(month) }, () => 0);
  done.forEach((b) => {
    byDay[Number(b.date.slice(8, 10)) - 1]! += priceOf(b);
  });

  const revenue = done.reduce((sum, b) => sum + priceOf(b), 0);
  const bestDayIndex = byDay.reduce((best, value, i) => (value > (byDay[best] ?? 0) ? i : best), 0);

  return {
    total: inMonth.length,
    revenue,
    done: done.length,
    missed: inMonth.filter((b) => b.status === "faltou").length,
    average: done.length ? revenue / done.length : 0,
    upcomingValue: upcoming.reduce((sum, b) => sum + priceOf(b), 0),
    upcomingCount: upcoming.length,
    // horários que já passaram mas ainda não foram marcados como concluídos ou falta
    unmarked: scheduled.filter((b) => b.date < today).length,
    byDay,
    bestDay: byDay[bestDayIndex] ? { day: bestDayIndex + 1, value: byDay[bestDayIndex]! } : null,
    byService: Object.values(
      inMonth
        .filter((b) => b.status !== "cancelado")
        .reduce<Record<string, { name: string; count: number; revenue: number }>>((acc, b) => {
          const row = (acc[b.serviceName] ??= { name: b.serviceName, count: 0, revenue: 0 });
          row.count += 1;
          if (b.status === "concluido") row.revenue += b.price;
          return acc;
        }, {}),
    ).sort((a, b) => b.revenue - a.revenue || b.count - a.count),
  };
}

// ---------- tela ----------

export function RevenueReport({ version = 0 }: { version?: number }) {
  const current = currentMonth();
  const [month, setMonth] = useState(current);
  const maxMonth = shiftMonth(current, 2);

  // O gráfico "Últimos meses" mostra 6 meses terminando no mês atual (ou no escolhido, se for mais novo).
  // Se o mês escolhido for bem antigo, a janela passa a começar nele.
  const trendEnd =
    month >= shiftMonth(current, -5) ? (month > current ? month : current) : shiftMonth(month, 5);
  const firstMonth =
    shiftMonth(month, -1) < shiftMonth(trendEnd, -5)
      ? shiftMonth(month, -1)
      : shiftMonth(trendEnd, -5);
  const from = `${firstMonth}-01`;
  const to = `${trendEnd}-${String(daysInMonth(trendEnd)).padStart(2, "0")}`;

  const loaded = useOwnerLoad(() => ownerBookings({ data: { from, to } }), [from, to, version]);
  const bookings = loaded.data ?? [];

  const stats = monthStats(bookings, month);
  const previous = monthStats(bookings, shiftMonth(month, -1));

  // No mês em andamento, compara só com o mesmo período do mês anterior (senão sempre parece queda).
  const inProgress = month === current;
  const previousRevenue = inProgress
    ? previous.byDay.slice(0, Number(todayKey().slice(8, 10))).reduce((sum, v) => sum + v, 0)
    : previous.revenue;
  const change =
    previousRevenue > 0
      ? Math.round(((stats.revenue - previousRevenue) / previousRevenue) * 100)
      : null;
  const maxDay = Math.max(...stats.byDay, 1);

  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(trendEnd, i - 5);
    return { month: m, revenue: monthStats(bookings, m).revenue };
  });
  const maxTrend = Math.max(...trend.map((t) => t.revenue), 1);
  const totalServiceRevenue = stats.byService.reduce((sum, s) => sum + s.revenue, 0);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Mês anterior"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft />
        </Button>
        <h2 className="text-lg min-w-44 text-center" aria-live="polite">
          {monthName(month)}
        </h2>
        <Button
          variant="outline"
          size="icon"
          aria-label="Próximo mês"
          disabled={month >= maxMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight />
        </Button>
        {month !== current && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(current)}>
            Este mês
          </Button>
        )}
      </div>

      {loaded.error && !loaded.data && (
        <p role="alert" className="text-sm text-destructive mt-6">
          {loaded.error}
        </p>
      )}

      <div className="mt-6 border-b border-border pb-6">
        <span className="text-xs text-muted-foreground">Faturamento realizado</span>
        <strong
          className="metric-value text-primary !text-[clamp(32px,9vw,52px)]"
          data-testid="revenue"
        >
          {money(stats.revenue)}
        </strong>
        <p className="text-sm mt-3 flex items-center gap-2">
          {change === null ? (
            <span className="text-muted-foreground">Sem dados do mês anterior para comparar.</span>
          ) : (
            <>
              {change >= 0 ? (
                <TrendingUp className="size-4 text-success" />
              ) : (
                <TrendingDown className="size-4 text-destructive" />
              )}
              <span className={change >= 0 ? "text-success" : "text-destructive"}>
                {change >= 0 ? "+" : ""}
                {change}%
              </span>
              <span className="text-muted-foreground">
                {inProgress ? "em relação ao mesmo período de " : "em relação a "}
                {monthName(shiftMonth(month, -1))}
              </span>
            </>
          )}
        </p>
        {stats.upcomingCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Ainda a receber: {money(stats.upcomingValue)} em {stats.upcomingCount}{" "}
            {stats.upcomingCount === 1 ? "agendamento" : "agendamentos"}.
          </p>
        )}
        {stats.unmarked > 0 && (
          <p className="text-xs text-primary mt-2 flex items-start gap-2">
            <TriangleAlert className="size-4 shrink-0" />
            {stats.unmarked}{" "}
            {stats.unmarked === 1 ? "horário passado ainda está" : "horários passados ainda estão"}{" "}
            como "agendado". Marque como concluído ou falta na Agenda para entrar na conta.
          </p>
        )}
      </div>

      <div className="metrics">
        <div className="metric">
          <span className="text-xs text-muted-foreground">Atendimentos</span>
          <strong className="metric-value">{stats.done}</strong>
        </div>
        <div className="metric">
          <span className="text-xs text-muted-foreground">Ticket médio</span>
          <strong className="metric-value !text-[clamp(15px,4.4vw,28px)]">
            {money(stats.average)}
          </strong>
        </div>
        <div className="metric">
          <span className="text-xs text-muted-foreground">Faltas</span>
          <strong className="metric-value">{stats.missed}</strong>
        </div>
      </div>

      {stats.total === 0 ? (
        <p className="text-muted-foreground text-sm py-10">Nenhum agendamento neste mês.</p>
      ) : (
        <>
          <h3 className="text-lg mt-6 mb-4">Dia a dia</h3>
          <div
            className="flex items-end gap-[3px] h-36"
            role="img"
            aria-label={`Faturamento por dia em ${monthName(month)}`}
          >
            {stats.byDay.map((value, i) => (
              <div
                key={i}
                title={`Dia ${i + 1}: ${money(value)}`}
                className={`flex-1 min-w-0 rounded-t-sm ${value > 0 ? "bg-primary" : "bg-muted"}`}
                style={{ height: value > 0 ? `${Math.max(8, (value / maxDay) * 100)}%` : "3px" }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
            <span>1</span>
            <span>{Math.round(stats.byDay.length / 2)}</span>
            <span>{stats.byDay.length}</span>
          </div>
          {stats.bestDay && (
            <p className="text-xs text-muted-foreground mt-3">
              Melhor dia: {stats.bestDay.day} ({money(stats.bestDay.value)}).
            </p>
          )}

          <h3 className="text-lg mt-8 mb-4">Últimos meses</h3>
          <div className="grid grid-cols-6 gap-2 h-40">
            {trend.map((t) => (
              <button
                key={t.month}
                type="button"
                onClick={() => setMonth(t.month)}
                aria-label={`${monthName(t.month)}: ${money(t.revenue)}`}
                aria-pressed={t.month === month}
                className="flex flex-col items-center justify-end gap-2 min-w-0 h-full cursor-pointer"
              >
                <span className="text-[10px] text-muted-foreground max-w-full truncate">
                  {compactMoney(t.revenue)}
                </span>
                <span className="flex-1 w-full flex items-end">
                  <span
                    className={`block w-full rounded-t-sm ${t.month === month ? "bg-primary" : "bg-primary/35"}`}
                    style={{
                      height:
                        t.revenue > 0 ? `${Math.max(6, (t.revenue / maxTrend) * 100)}%` : "3px",
                    }}
                  />
                </span>
                <span
                  className={`text-[11px] ${t.month === month ? "text-primary" : "text-muted-foreground"}`}
                >
                  {monthShort(t.month)}
                </span>
              </button>
            ))}
          </div>

          <h3 className="text-lg mt-8 mb-2">Serviços</h3>
          {stats.byService.map(({ name, count, revenue }) => (
            <div key={name} className="py-4 border-b border-border">
              <div className="flex justify-between gap-3 text-sm">
                <span>{name}</span>
                <strong className="text-primary">{money(revenue)}</strong>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  {count} {count === 1 ? "agendamento" : "agendamentos"}
                </span>
                <span>
                  {totalServiceRevenue ? Math.round((revenue / totalServiceRevenue) * 100) : 0}% do
                  faturamento
                </span>
              </div>
              <div className="h-1.5 rounded bg-muted mt-2">
                <div
                  className="h-full rounded bg-primary"
                  style={{
                    width: `${totalServiceRevenue ? (revenue / totalServiceRevenue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
