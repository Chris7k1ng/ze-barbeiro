import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AdminPanel } from "@/components/admin/admin-panel";
import { LoginForm } from "@/components/admin/login-form";
import { getOwnerSession, ownerLogout } from "@/lib/api.functions";

export const Route = createFileRoute("/admin")({
  loader: () => getOwnerSession(),
  head: () => ({
    meta: [
      { title: "Painel do barbeiro | Zé Filho" },
      { name: "description", content: "Agenda, serviços e horários da barbearia Zé Filho." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const session = Route.useLoaderData();
  const router = useRouter();
  const [authed, setAuthed] = useState(session.authed);

  if (!authed)
    return <LoginForm configured={session.configured} onSuccess={() => setAuthed(true)} />;

  return (
    <AdminPanel
      onLogout={async () => {
        await ownerLogout();
        setAuthed(false);
        router.invalidate();
      }}
    />
  );
}
