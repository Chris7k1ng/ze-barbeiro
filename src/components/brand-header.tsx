import { Link } from "@tanstack/react-router";
import { CalendarDays, Instagram, MapPin, MessageCircle, Scissors } from "lucide-react";
import logo from "@/assets/ze-filho-logo.png";
import { instagramUrl, mapsUrl, shopInfo, whatsappUrl } from "@/lib/shop-info";

// Os links começam com "/" para também funcionarem nas outras páginas (ex.: Meu horário).
export function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="shell h-full flex items-center justify-between gap-3 md:gap-8">
        <a href="/" className="flex min-w-0 items-center gap-3 md:gap-4">
          <img
            className="brand-logo shrink-0"
            src={logo}
            alt="Logo Zé Filho Barbeiro"
            width={72}
            height={72}
          />
          <div className="min-w-0">
            <p className="font-display text-base sm:text-xl md:text-2xl font-semibold tracking-tight truncate">
              ZÉ FILHO <span className="text-primary">BARBEIRO</span>
            </p>
            <p className="text-[8px] sm:text-[10px] md:text-[11px] text-muted-foreground mt-1 uppercase tracking-[1px] md:tracking-[1.5px] truncate">
              Estilo e tradição desde 2021
            </p>
          </div>
        </a>
        <nav
          className="brand-nav hidden md:flex items-center gap-8"
          aria-label="Navegação principal"
        >
          <a className="brand-nav-link active" href="/#inicio">
            Início
          </a>
          <a className="brand-nav-link" href="/#servicos">
            Serviços
          </a>
          <a className="brand-nav-link" href="/#sobre">
            Sobre
          </a>
          <a className="brand-nav-link" href="/#contato">
            Contato
          </a>
          <Link className="brand-nav-link" to="/meu-agendamento">
            Meu horário
          </Link>
          <a className="brand-book" href="/#agendamento">
            <CalendarDays className="size-4" />
            Agendar agora
          </a>
        </nav>
        {/* No celular o menu completo não cabe: fica só o atalho mais importante */}
        <Link
          to="/meu-agendamento"
          className="md:hidden shrink-0 rounded-full border border-border px-3 py-2 text-xs text-primary"
        >
          Meu horário
        </Link>
      </div>
    </header>
  );
}

export function BrandFooter() {
  const maps = mapsUrl();
  const insta = instagramUrl();
  const wa = whatsappUrl("Olá! Gostaria de falar com o Zé Filho Barbeiro.");
  return (
    <footer id="contato" className="page-footer">
      <div className="shell">
        {(shopInfo.address || insta || wa) && (
          <div className="flex flex-wrap gap-x-8 gap-y-3 pb-5 mb-5 border-b border-border text-xs">
            {shopInfo.address && (
              <a
                href={maps ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-foreground"
              >
                <MapPin className="size-3.5 text-primary" />
                {shopInfo.address}
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-foreground"
              >
                <MessageCircle className="size-3.5 text-primary" />
                WhatsApp
              </a>
            )}
            {insta && (
              <a
                href={insta}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-foreground"
              >
                <Instagram className="size-3.5 text-primary" />@
                {shopInfo.instagram.replace(/^@/, "")}
              </a>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-4">
          <span>© {new Date().getFullYear()} Zé Filho Barbeiro</span>
          <span className="flex gap-2 items-center">
            <Scissors className="size-3 text-primary" />
            Feito para cuidar do seu estilo.
          </span>
        </div>
      </div>
    </footer>
  );
}
