import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CalendarOff,
  LogOut,
  Plus,
  Scissors,
  Settings,
} from "lucide-react";
import { BlockDialog, BookingDialog, ServiceDialog } from "@/components/admin/dialogs";
import { OwnerContext } from "@/components/admin/owner-context";
import {
  AgendaTab,
  BlocksTab,
  RemindersTab,
  ServicesTab,
  SettingsTab,
} from "@/components/admin/tabs";
import { RevenueReport } from "@/components/revenue-report";
import { Button } from "@/components/ui/button";
import logo from "@/assets/ze-filho-logo.png";
import { todayKey, type Service } from "@/lib/shop";

const navigation = [
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "lembretes", label: "Lembretes", icon: Bell },
  { id: "bloqueios", label: "Bloqueios", icon: CalendarOff },
  { id: "servicos", label: "Serviços", icon: Scissors },
  { id: "configuracoes", label: "Configurações", icon: Settings },
  { id: "relatorio", label: "Relatório", icon: BarChart3 },
] as const;

type Tab = (typeof navigation)[number]["id"];
type Modal =
  { type: "booking" } | { type: "block" } | { type: "service"; service: Service | null } | null;

export function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("agenda");
  const [modal, setModal] = useState<Modal>(null);
  // sobe um número sempre que algo é salvo, para as abas buscarem os dados de novo
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const owner = useMemo(() => ({ logout: onLogout }), [onLogout]);
  const close = () => setModal(null);

  return (
    <OwnerContext.Provider value={owner}>
      <div className="admin-frame">
        <aside className="admin-sidebar">
          <div className="flex min-w-0 items-center gap-3">
            <img
              className="brand-logo shrink-0"
              src={logo}
              width={62}
              height={62}
              alt="Zé Filho Barbeiro"
            />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold whitespace-nowrap">ZÉ FILHO</p>
              <p className="text-[10px] text-primary">Painel do barbeiro</p>
            </div>
          </div>
          <nav className="admin-nav">
            {navigation.map((item) => (
              <Button
                key={item.id}
                variant={tab === item.id ? "secondary" : "ghost"}
                className={`admin-nav-item ${tab === item.id ? "text-primary" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <item.icon />
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="hidden md:block mt-16">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Painel administrativo
              <br />
              Dados salvos no Neon
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 -ml-3 text-muted-foreground"
              onClick={onLogout}
            >
              <LogOut />
              Sair
            </Button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Zé Filho Barbeiro</p>
              <h1 className="section-title mt-2">
                {tab === "agenda" ? "Sua agenda" : navigation.find((n) => n.id === tab)?.label}
              </h1>
              <p className="text-xs text-muted-foreground mt-2">
                {tab === "agenda"
                  ? "Cada horário, um novo estilo."
                  : "Tudo em dia para atender bem."}
              </p>
            </div>
            <div className="flex gap-2 items-center shrink-0">
              {tab === "agenda" && (
                <Button onClick={() => setModal({ type: "booking" })}>
                  <Plus />
                  <span className="hidden sm:inline">Agendar</span>
                </Button>
              )}
              {tab === "servicos" && (
                <Button onClick={() => setModal({ type: "service", service: null })}>
                  <Plus />
                  <span className="hidden sm:inline">Novo serviço</span>
                </Button>
              )}
              {tab === "bloqueios" && (
                <Button onClick={() => setModal({ type: "block" })}>
                  <Plus />
                  <span className="hidden sm:inline">Bloquear horário</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Sair"
                onClick={onLogout}
              >
                <LogOut />
              </Button>
            </div>
          </header>

          {tab === "agenda" && (
            <AgendaTab version={version} onNewBooking={() => setModal({ type: "booking" })} />
          )}
          {tab === "lembretes" && <RemindersTab version={version} />}
          {tab === "bloqueios" && <BlocksTab version={version} />}
          {tab === "servicos" && (
            <ServicesTab
              version={version}
              onEdit={(service) => setModal({ type: "service", service })}
            />
          )}
          {tab === "configuracoes" && <SettingsTab version={version} />}
          {tab === "relatorio" && <RevenueReport version={version} />}
        </main>

        <BookingDialog
          open={modal?.type === "booking"}
          onClose={close}
          onSaved={refresh}
          defaultDate={todayKey()}
        />
        <BlockDialog
          open={modal?.type === "block"}
          onClose={close}
          onSaved={refresh}
          defaultDate={todayKey()}
        />
        <ServiceDialog
          open={modal?.type === "service"}
          onClose={close}
          onSaved={refresh}
          service={modal?.type === "service" ? modal.service : null}
        />
      </div>
    </OwnerContext.Provider>
  );
}
