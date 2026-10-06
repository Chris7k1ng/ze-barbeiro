import { createContext, useContext, useEffect } from "react";
import { toast } from "sonner";
import type { Result } from "@/lib/api.functions";
import { useLoad } from "@/lib/use-load";

type Owner = { logout: () => void };
export const OwnerContext = createContext<Owner>({ logout: () => {} });

/** Carrega dados do painel; se a sessão tiver expirado, volta para a tela de senha. */
export function useOwnerLoad<T>(load: () => Promise<Result<T>>, deps: unknown[]) {
  const { logout } = useContext(OwnerContext);
  const state = useLoad(load, deps);
  useEffect(() => {
    if (state.code === "UNAUTH") logout();
  }, [state.code, logout]);
  return state;
}

/**
 * Executa uma ação do painel (salvar, cancelar...). Mostra o erro em um aviso
 * (ou entrega a mensagem para `onError`, para mostrar dentro de uma janela) e devolve se deu certo.
 */
export function useOwnerCall() {
  const { logout } = useContext(OwnerContext);
  return async function call<T>(
    work: Promise<Result<T>>,
    options: { success?: string; onError?: (message: string) => void } = {},
  ): Promise<{ ok: true; data: T } | { ok: false }> {
    const fail = (message: string) =>
      options.onError ? options.onError(message) : toast.error(message);
    try {
      const result = await work;
      if (result.ok) {
        if (options.success) toast.success(options.success);
        return { ok: true, data: result.data };
      }
      if (result.code === "UNAUTH") logout();
      fail(result.error);
    } catch {
      fail("Não foi possível conectar. Verifique sua internet.");
    }
    return { ok: false };
  };
}
