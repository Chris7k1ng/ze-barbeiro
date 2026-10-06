// Dados da barbearia usados no site (WhatsApp, endereço, Instagram).
// Preencha os campos abaixo. Enquanto um campo estiver vazio ("") o botão ou
// o trecho correspondente simplesmente não aparece no site.
export const shopInfo = {
  // WhatsApp da barbearia só com números, com DDD. Ex.: "85999990000"
  whatsapp: "85987912904",
  // Endereço completo. Ex.: "Rua das Flores, 123 - Aldeota, Fortaleza - CE"
  address: "Adelino Martins, 1478 - Santa Clara, Canindé - CE",
  // Usuário do Instagram, sem o @. Ex.: "zefilhobarbeiro"
  instagram: "zefilho_barbeiro",
};

/** Link do Google Maps para o endereço (ou null se não houver endereço). */
export function mapsUrl() {
  return shopInfo.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopInfo.address)}`
    : null;
}

/** Link do WhatsApp da barbearia com mensagem pronta (ou null se não houver número). */
export function whatsappUrl(message: string) {
  const digits = shopInfo.whatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/55${digits}?text=${encodeURIComponent(message)}` : null;
}

/** Link do Instagram (ou null se não houver usuário). */
export function instagramUrl() {
  const user = shopInfo.instagram.replace(/^@/, "").trim();
  return user ? `https://instagram.com/${user}` : null;
}
