import { useState } from "react";
import { ArrowLeft, CalendarDays, ChevronRight } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAvailability } from "@/lib/api.functions";
import { cap } from "@/lib/format";
import { dayLabel, todayKey } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";

const DAYS_SHOWN = 14;
const DAYS_PER_PAGE = 6;

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Props = {
  /** novo agendamento: o serviço escolhido */
  serviceId?: string;
  /** remarcar: o link secreto do agendamento */
  token?: string;
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
  /** aumente este número para buscar os horários de novo (ex.: depois de um horário ser ocupado) */
  version?: number;
};

/** Escolha do dia e do horário. Os horários livres vêm do servidor, sempre atualizados. */
export function DateTimePicker({ serviceId, token, date, time, onChange, version = 0 }: Props) {
  const [page, setPage] = useState(0);
  const availability = useLoad(
    () => getAvailability({ data: { serviceId, token, from: todayKey(), days: DAYS_SHOWN } }),
    [serviceId, token, version],
  );

  const openDays = (availability.data ?? []).filter((d) => d.open);
  const slots = openDays.find((d) => d.date === date)?.slots ?? [];
  const visible = openDays.slice(page * DAYS_PER_PAGE, page * DAYS_PER_PAGE + DAYS_PER_PAGE);

  if (availability.loading && !availability.data) {
    return <p className="text-sm text-muted-foreground py-10">Carregando horários…</p>;
  }
  if (availability.error && !availability.data) {
    return (
      <div className="py-8">
        <p role="alert" className="text-sm text-destructive">
          {availability.error}
        </p>
        <Button variant="outline" className="mt-4" onClick={availability.reload}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mt-6">
        <span className="text-sm">
          {cap(
            dayLabel(openDays[page * DAYS_PER_PAGE]?.date ?? todayKey(), {
              month: "long",
              year: "numeric",
            }),
          )}
        </span>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Abrir calendário"
                title="Abrir calendário"
              >
                <CalendarDays />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
              <Calendar
                locale={ptBR}
                mode="single"
                selected={date ? new Date(date + "T12:00:00") : undefined}
                onSelect={(d) => {
                  if (d) onChange(keyOf(d), "");
                }}
                disabled={(d) => !openDays.some((day) => day.date === keyOf(d))}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            aria-label="Dias anteriores"
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={(page + 1) * DAYS_PER_PAGE >= openDays.length}
            onClick={() => setPage(page + 1)}
            aria-label="Próximos dias"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="date-strip">
        {visible.map((d) => (
          <Button
            key={d.date}
            variant={date === d.date ? "default" : "outline"}
            className="date-button"
            onClick={() => onChange(d.date, "")}
          >
            <span className="text-[10px] uppercase">
              {d.date === todayKey()
                ? "Hoje"
                : dayLabel(d.date, { weekday: "short" }).replace(".", "")}
            </span>
            <strong className="text-xl">{dayLabel(d.date, { day: "numeric" })}</strong>
          </Button>
        ))}
      </div>

      {date && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Horários disponíveis</h3>
            <span className="text-[10px] text-muted-foreground">Horário do Ceará</span>
          </div>
          <div className="slots">
            {slots.map((t) => (
              <Button
                key={t}
                variant={time === t ? "default" : "outline"}
                className="time-slot"
                onClick={() => onChange(date, t)}
              >
                {t}
              </Button>
            ))}
          </div>
          {!slots.length && (
            <p className="text-sm text-muted-foreground py-7">
              Nenhum horário disponível neste dia. Escolha outra data.
            </p>
          )}
        </>
      )}
    </>
  );
}
