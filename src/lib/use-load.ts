import { useCallback, useEffect, useRef, useState } from "react";
import type { Result } from "@/lib/api.functions";

/** Chama o servidor e guarda o resultado. `reload()` busca de novo (depois de salvar algo). */
export function useLoad<T>(load: () => Promise<Result<T>>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const latest = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  const reload = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true);
    try {
      const result = await loader.current();
      if (call !== latest.current) return; // chegou uma resposta mais nova
      if (result.ok) {
        setData(result.data);
        setError("");
        setCode("");
      } else {
        setError(result.error);
        setCode(result.code);
      }
    } catch {
      if (call === latest.current) setError("Não foi possível conectar. Verifique sua internet.");
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), deps);
  return { data, error, code, loading, reload };
}
