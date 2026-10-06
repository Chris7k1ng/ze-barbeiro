import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ownerLogin } from "@/lib/api.functions";
import logo from "@/assets/ze-filho-logo.png";

export function LoginForm({
  configured,
  onSuccess,
}: {
  configured: boolean;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await ownerLogin({ data: { password } });
      if (result.ok) onSuccess();
      else setError(result.error);
    } catch {
      setError("Não foi possível conectar. Verifique sua internet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell min-h-screen grid place-items-center">
      <div className="confirmation w-full max-w-sm">
        <img
          className="brand-logo mx-auto"
          src={logo}
          width={72}
          height={72}
          alt="Zé Filho Barbeiro"
        />
        <p className="eyebrow mt-6">Painel do barbeiro</p>
        <h1 className="section-title mt-2">Entrar</h1>
        {configured ? (
          <form onSubmit={submit} className="mt-6 space-y-3 text-left">
            <label className="field-label">
              Senha
              <Input
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
              />
            </label>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button className="w-full h-12" disabled={busy || !password}>
              <Lock />
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 text-left text-sm text-muted-foreground leading-relaxed">
            <p className="text-foreground">A senha do painel ainda não foi definida.</p>
            <p className="mt-3">
              Abra o arquivo <code className="text-primary">.env.local</code>, acrescente a linha
              abaixo com a senha que você quiser (use 10 caracteres ou mais) e reinicie o programa:
            </p>
            <pre className="mt-3 rounded-md border border-border p-3 text-xs text-foreground overflow-x-auto">
              ADMIN_PASSWORD=sua-senha-aqui
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
