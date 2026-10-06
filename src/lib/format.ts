/** Formata dígitos como telefone brasileiro: 85999990001 -> (85) 99999-0001 */
export function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Extrai só os dígitos (máx. 11) do que a pessoa digitou. */
export function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Primeira letra maiúscula, o resto como está: "seg., 5 de outubro" -> "Seg., 5 de outubro". */
export function cap(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
