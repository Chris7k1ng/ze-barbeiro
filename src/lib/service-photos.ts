// Fotos prontas dos serviços (arquivos em public/servicos).
// Se o serviço não tiver foto própria cadastrada no painel, usamos uma destas pelo nome.
import type { Service } from "@/lib/shop";

export const servicePhotoOptions = [
  { label: "Corte", src: "/servicos/corte.png" },
  { label: "Barba", src: "/servicos/barba.png" },
  { label: "Corte + Barba", src: "/servicos/combo.png" },
  { label: "Sobrancelha", src: "/servicos/sobrancelha.png" },
  { label: "Tratamento", src: "/servicos/tratamento.png" },
] as const;

const pick = (label: (typeof servicePhotoOptions)[number]["label"]) =>
  servicePhotoOptions.find((o) => o.label === label)!.src;

/** Foto sugerida pelo nome do serviço (undefined se nenhuma combinar). */
export function defaultServicePhoto(name: string): string | undefined {
  const n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (n.includes("sobrancelha")) return pick("Sobrancelha");
  if (/hidrata|alisa|progressiva|relax|tratamento/.test(n)) return pick("Tratamento");
  if (n.includes("corte") && /barba|alinhamento|\+/.test(n)) return pick("Corte + Barba");
  if (/barba|alinhamento/.test(n)) return pick("Barba");
  if (/corte|pezinho|degrade|cabelo/.test(n)) return pick("Corte");
  return undefined;
}

/** Foto a mostrar: a cadastrada no painel ou, na falta dela, a sugerida pelo nome. */
export const servicePhoto = (service: Pick<Service, "name" | "photo">) =>
  service.photo || defaultServicePhoto(service.name);
