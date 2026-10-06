import { useRouter } from "@tanstack/react-router";
import { BrandFooter, BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";

/** Tela mostrada quando o servidor ou o banco de dados não respondem. */
export function ServiceUnavailable({ message }: { message: string }) {
  const router = useRouter();
  return (
    <>
      <BrandHeader />
      <main className="shell">
        <div className="confirmation">
          <p className="eyebrow">Ops</p>
          <h1 className="section-title mt-3">Estamos com um problema por aqui</h1>
          <p className="text-sm text-muted-foreground mt-4">{message}</p>
          <Button className="mt-6" onClick={() => router.invalidate()}>
            Tentar de novo
          </Button>
        </div>
      </main>
      <BrandFooter />
    </>
  );
}
