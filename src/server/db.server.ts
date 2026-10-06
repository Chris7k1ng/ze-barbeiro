import { neon } from "@neondatabase/serverless";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;
export type Statement = { text: string; params?: unknown[] };

/** O mínimo que o sistema precisa do banco. Em produção é o Neon; nos testes, um Postgres em memória. */
export interface Db {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  /** Roda várias instruções numa transação só: ou todas dão certo, ou nenhuma. */
  batch(statements: Statement[]): Promise<void>;
}

export function createNeonDb(connectionString: string): Db {
  const sql = neon(connectionString);
  return {
    query: async (text, params = []) => (await sql.query(text, params)) as Row[],
    batch: async (statements) => {
      await sql.transaction(statements.map((s) => sql.query(s.text, s.params ?? [])));
    },
  };
}
