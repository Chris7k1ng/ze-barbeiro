import { createNeonDb } from "./db.server";
import { migrate } from "./migrations.server";
import { createRepo } from "./repo.server";
import { createActions, type Actions } from "./actions.server";

/** Lê uma variável de ambiente (do .env no seu computador, ou do painel do serviço de hospedagem). */
export function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

let ready: Promise<Actions> | undefined;

/**
 * Conecta no Neon e cria/atualiza as tabelas na primeira vez que alguém usa o sistema.
 * Depois disso, reaproveita a mesma conexão (não recria nada a cada pedido).
 */
export function getActions(): Promise<Actions> {
  if (!ready) {
    ready = (async () => {
      const url = env("DATABASE_URL");
      if (!url) {
        throw new Error(
          "DATABASE_URL não configurada. Copie o arquivo .env.example para .env.local e cole o endereço do seu banco Neon.",
        );
      }
      const db = createNeonDb(url);
      const { version, applied } = await migrate(db);
      console.log(
        `[banco] pronto (versão ${version}${applied ? `, ${applied} migração(ões) aplicada(s)` : ""}).`,
      );
      return createActions(createRepo(db));
    })();
    // se falhar (rede, senha errada...), a próxima chamada tenta de novo
    ready.catch((error) => {
      console.error(
        "[banco] não foi possível iniciar:",
        error instanceof Error ? error.message : error,
      );
      ready = undefined;
    });
  }
  return ready;
}
