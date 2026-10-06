import { createFileRoute } from "@tanstack/react-router";
import { BookingFlow } from "@/components/booking-flow";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { getPublicInfo } from "@/lib/api.functions";

export const Route = createFileRoute("/")({
  loader: () => getPublicInfo(),
  head: () => ({
    meta: [
      { title: "Agende seu horário | Zé Filho Barbeiro" },
      {
        name: "description",
        content: "Escolha seu corte ou barba e agende seu horário com Zé Filho Barbeiro.",
      },
      { property: "og:title", content: "Agende seu horário | Zé Filho Barbeiro" },
      {
        property: "og:description",
        content: "Corte, barba e cuidado no seu estilo. Escolha seu próximo horário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const info = Route.useLoaderData();
  if (!info.ok) return <ServiceUnavailable message={info.error} />;
  return <BookingFlow services={info.data.services} settings={info.data.settings} />;
}
