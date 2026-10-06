import type { Db } from "./db.server";

// Cada migração roda UMA vez e fica registrada na tabela "meta". Para mudar o banco no futuro,
// acrescente uma nova migração ao fim da lista (nunca edite uma que já rodou).
// Todas as instruções são idempotentes (IF NOT EXISTS / ON CONFLICT DO NOTHING), então é seguro
// que dois servidores iniciem ao mesmo tempo.

type Migration = { version: number; description: string; statements: string[] };

const defaultServices: Array<[string, string, string, number, number, number]> = [
  // id, nome, descrição, preço em centavos, duração em minutos, ordem
  ["corte", "Corte", "Do clássico ao degradê, com acabamento no seu estilo.", 3000, 30, 1],
  [
    "barba",
    "Barba",
    "Alinhamento, acabamento e cuidado para deixar a barba impecável.",
    2500,
    30,
    2,
  ],
  [
    "alinhamento",
    "Alinhamento de barba",
    "Contorno e definição para um acabamento limpo e preciso.",
    1500,
    20,
    3,
  ],
  [
    "pezinho",
    "Pezinho",
    "Acabamento da nuca e das laterais para manter o corte alinhado.",
    1000,
    15,
    4,
  ],
  [
    "sobrancelha",
    "Sobrancelha",
    "Limpeza e alinhamento para valorizar o formato do rosto.",
    500,
    10,
    5,
  ],
  [
    "hidratacao",
    "Hidratação",
    "Tratamento para devolver maciez, brilho e cuidado aos fios.",
    2500,
    30,
    6,
  ],
  ["alisamento", "Alisamento", "Tratamento para alinhar os fios e reduzir o volume.", 3500, 60, 7],
  [
    "combo",
    "Corte + Barba",
    "O visual completo com corte e barba por um preço especial.",
    5000,
    60,
    8,
  ],
  [
    "combo-alinhamento",
    "Corte + Alinhamento",
    "Corte completo com alinhamento de barba e acabamento.",
    4500,
    50,
    9,
  ],
];

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

export const migrations: Migration[] = [
  {
    version: 1,
    description: "Tabelas iniciais: configurações, serviços, agendamentos e bloqueios",
    statements: [
      `CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        nome TEXT NOT NULL,
        abre TIME NOT NULL,
        fecha TIME NOT NULL,
        almoco_inicio TIME NOT NULL,
        almoco_fim TIME NOT NULL,
        intervalo_min INTEGER NOT NULL DEFAULT 0 CHECK (intervalo_min BETWEEN 0 AND 60),
        dias_fechados TEXT NOT NULL DEFAULT '0' CHECK (dias_fechados ~ '^([0-6](,[0-6])*)?$')
      )`,
      `INSERT INTO configuracoes (id, nome, abre, fecha, almoco_inicio, almoco_fim, intervalo_min, dias_fechados)
       VALUES (1, 'Zé Filho Barbeiro', '08:00', '19:00', '12:00', '13:00', 0, '0')
       ON CONFLICT (id) DO NOTHING`,

      `CREATE TABLE IF NOT EXISTS servicos (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 80),
        descricao TEXT NOT NULL DEFAULT '',
        preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
        duracao_min INTEGER NOT NULL CHECK (duracao_min BETWEEN 5 AND 480),
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        foto TEXT,
        ordem INTEGER NOT NULL DEFAULT 0,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `INSERT INTO servicos (id, nome, descricao, preco_centavos, duracao_min, ordem) VALUES
        ${defaultServices
          .map(
            ([id, nome, desc, preco, dur, ordem]) =>
              `(${q(id)}, ${q(nome)}, ${q(desc)}, ${preco}, ${dur}, ${ordem})`,
          )
          .join(",\n        ")}
       ON CONFLICT (id) DO NOTHING`,

      // O preço, o nome e a duração do serviço ficam gravados no agendamento: mudar o preço
      // depois não altera o faturamento dos atendimentos antigos.
      // "periodo" é calculado sozinho e a regra EXCLUDE impede, no próprio banco, dois
      // agendamentos ativos com horários que se sobrepõem (mesmo que dois clientes cliquem juntos).
      `CREATE TABLE IF NOT EXISTS agendamentos (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        nome_cliente TEXT NOT NULL CHECK (length(nome_cliente) BETWEEN 2 AND 80),
        telefone TEXT NOT NULL CHECK (telefone ~ '^[0-9]{10,11}$'),
        servico_id TEXT REFERENCES servicos(id) ON DELETE SET NULL,
        servico_nome TEXT NOT NULL,
        preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
        duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
        data DATE NOT NULL,
        horario TIME NOT NULL,
        periodo TSRANGE GENERATED ALWAYS AS (
          tsrange(data + horario, data + horario + make_interval(mins => duracao_min), '[)')
        ) STORED,
        status TEXT NOT NULL DEFAULT 'agendado'
          CHECK (status IN ('agendado', 'concluido', 'faltou', 'cancelado')),
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT agendamentos_sem_sobreposicao
          EXCLUDE USING gist (periodo WITH &&) WHERE (status <> 'cancelado')
      )`,
      `CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos (data)`,
      `CREATE INDEX IF NOT EXISTS idx_agendamentos_telefone ON agendamentos (telefone, data)`,

      `CREATE TABLE IF NOT EXISTS bloqueios (
        id TEXT PRIMARY KEY,
        data DATE NOT NULL,
        inicio TIME NOT NULL,
        fim TIME NOT NULL,
        motivo TEXT NOT NULL DEFAULT '',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (fim > inicio)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bloqueios_data ON bloqueios (data)`,
    ],
  },
];

/** Cria/atualiza as tabelas. Pode ser chamada quantas vezes quiser: só aplica o que falta. */
export async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`);
  const rows = await db.query(`SELECT valor FROM meta WHERE chave = 'schema_versao'`);
  const current = rows[0] ? Number(rows[0].valor) : 0;

  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    await db.batch([
      ...migration.statements.map((text) => ({ text })),
      {
        text: `INSERT INTO meta (chave, valor) VALUES ('schema_versao', $1)
               ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
        params: [String(migration.version)],
      },
    ]);
    console.log(`[banco] migração ${migration.version} aplicada: ${migration.description}`);
  }
  return { version: pending.at(-1)?.version ?? current, applied: pending.length };
}
