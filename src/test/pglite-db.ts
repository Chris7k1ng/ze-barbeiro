import { PGlite } from "@electric-sql/pglite";
import type { Db, Row } from "@/server/db.server";

/** Um Postgres de verdade rodando em memória, só para os testes (nada é enviado para a internet). */
export async function createTestDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.waitReady;
  return {
    query: async (text, params = []) => (await pg.query(text, params as unknown[])).rows as Row[],
    batch: async (statements) => {
      await pg.transaction(async (tx) => {
        for (const s of statements) await tx.query(s.text, s.params ?? []);
      });
    },
  };
}
