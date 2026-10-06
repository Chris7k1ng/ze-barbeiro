// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createActions, UserError, type Actions } from "@/server/actions.server";
import type { Db } from "@/server/db.server";
import { migrate } from "@/server/migrations.server";
import { createRepo, type Repo } from "@/server/repo.server";
import { createTestDb } from "./pglite-db";

// quinta-feira, 12:00 no Ceará. 2099-10-04 é domingo; 2099-10-05 é segunda.
const NOW = Date.parse("2099-10-01T12:00:00-03:00");
let db: Db;
let repo: Repo;
let api: Actions;

beforeAll(async () => {
  db = await createTestDb();
  await migrate(db);
  repo = createRepo(db);
  api = createActions(repo, () => NOW);
}, 60_000);

const phone = (n: number) => `8599999${String(n).padStart(4, "0")}`;
const book = (over: Record<string, unknown> = {}) =>
  api.createBooking({
    name: "Maria Silva",
    phone: phone(1),
    serviceId: "corte",
    date: "2099-10-05",
    time: "09:00",
    ...over,
  });
const slotsOf = async (serviceId: string, date: string, token?: string) => {
  const [day] = await api.availability({ serviceId, token, from: date, days: 1 });
  return day?.slots ?? [];
};
const fails = async (promise: Promise<unknown>, code?: string) => {
  const error = await promise.then(
    () => null,
    (e) => e,
  );
  expect(error).toBeInstanceOf(UserError);
  if (code) expect((error as UserError).code).toBe(code);
  return (error as UserError).message;
};

describe("criação automática do banco", () => {
  it("cria as tabelas e os 9 serviços na primeira vez", async () => {
    const services = await repo.listServices(false);
    expect(services.map((s) => s.id)).toContain("combo");
    expect(services).toHaveLength(9);
    expect((await db.query(`SELECT valor FROM meta WHERE chave = 'schema_versao'`))[0]?.valor).toBe(
      "1",
    );
  });

  it("rodar de novo não refaz nada e NÃO desfaz o que o dono editou", async () => {
    await api.adminSaveService({
      id: "corte",
      name: "Corte VIP",
      description: "x",
      price: 99,
      duration: 40,
      active: true,
    });
    expect((await migrate(db)).applied).toBe(0);
    await migrate(db);
    const corte = await repo.getService("corte");
    expect(corte).toMatchObject({ name: "Corte VIP", price: 99, duration: 40 });
    await api.adminSaveService({
      id: "corte",
      name: "Corte",
      description: "x",
      price: 30,
      duration: 30,
      active: true,
    });
    expect(await repo.listServices(false)).toHaveLength(9);
  });

  it("duas inicializações ao mesmo tempo não dão erro nem duplicam dados", async () => {
    const other = await createTestDb();
    await Promise.all([migrate(other), migrate(other)]);
    expect(await createRepo(other).listServices(false)).toHaveLength(9);
  });
});

describe("horários livres", () => {
  it("mostra os horários do dia e marca domingo como fechado", async () => {
    const days = await api.availability({ serviceId: "combo", from: "2099-10-03", days: 3 });
    expect(days.map((d) => [d.date, d.open])).toEqual([
      ["2099-10-03", true],
      ["2099-10-04", false],
      ["2099-10-05", true],
    ]);
    const mon = days[2]!.slots;
    expect(mon).toContain("08:00");
    expect(mon).not.toContain("11:30"); // combo de 60 min não cabe antes do almoço
    expect(mon).not.toContain("12:00");
  });
});

describe("novo agendamento", () => {
  it("salva, devolve um link secreto e tira o horário da lista", async () => {
    const result = await book({ time: "09:00" });
    expect(result.token.length).toBeGreaterThanOrEqual(40);
    expect(result).toMatchObject({
      serviceName: "Corte",
      price: 30,
      date: "2099-10-05",
      time: "09:00",
    });
    expect(await slotsOf("corte", "2099-10-05")).not.toContain("09:00");
  });

  it("não deixa dois horários se sobreporem (combo de 60 min às 10:00 bloqueia 10:30)", async () => {
    await book({ phone: phone(2), serviceId: "combo", time: "10:00" });
    const list = await slotsOf("corte", "2099-10-05");
    expect(list).not.toContain("10:00");
    expect(list).not.toContain("10:30");
    expect(list).toContain("11:00");
    await fails(book({ phone: phone(3), time: "10:30" }), "CONFLICT");
  });

  it("o próprio banco recusa sobreposição, mesmo se a regra do aplicativo fosse burlada", async () => {
    const result = await repo.insertBooking({
      id: "burla",
      token: "burla".repeat(10),
      name: "Burlador",
      phone: phone(9),
      serviceId: "corte",
      serviceName: "Corte",
      priceCents: 3000,
      duration: 30,
      date: "2099-10-05",
      time: "10:15",
    });
    expect(result).toEqual({ ok: false, reason: "overlap" });
  });

  it("dois clientes no mesmo instante: um fica com o horário e o outro recebe uma mensagem amigável", async () => {
    const results = await Promise.allSettled([
      book({ phone: phone(4), time: "15:00" }),
      book({ phone: phone(5), time: "15:00" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(UserError);
    expect(rejected.reason.message).not.toMatch(/duplicate|constraint|violat/i);
  });

  it("recusa dados inválidos e nada é salvo", async () => {
    const before = (await repo.bookingsInRange("2099-01-01", "2099-12-31")).length;
    await fails(book({ phone: "123" }));
    await fails(book({ name: "A" }));
    await fails(book({ name: "x".repeat(81) }));
    await fails(book({ serviceId: "nao-existe" }));
    await fails(book({ date: "2099-02-31" }));
    await fails(book({ date: "2099-09-30" }), "CONFLICT"); // passado
    await fails(book({ date: "2099-12-31" }), "CONFLICT"); // além de 60 dias
    await fails(book({ date: "2099-10-04", time: "10:00" }), "CONFLICT"); // domingo
    await fails(book({ time: "03:00" }), "CONFLICT"); // madrugada
    await fails(book({ time: "12:30" }), "CONFLICT"); // almoço
    await fails(book({ time: "25:99" }));
    await fails(api.createBooking("lixo"));
    expect((await repo.bookingsInRange("2099-01-01", "2099-12-31")).length).toBe(before);
  });

  it("limita a 3 agendamentos ativos por telefone", async () => {
    for (const time of ["16:00", "16:30", "17:00"]) await book({ phone: phone(7), time });
    await fails(book({ phone: phone(7), time: "17:30" }));
  });

  it("serviço desativado não pode ser agendado", async () => {
    await api.adminSaveService({
      id: "pezinho",
      name: "Pezinho",
      description: "x",
      price: 10,
      duration: 15,
      active: false,
    });
    await fails(book({ phone: phone(8), serviceId: "pezinho", time: "17:30" }));
    expect((await api.publicInfo()).services.map((s) => s.id)).not.toContain("pezinho");
    await api.adminSaveService({
      id: "pezinho",
      name: "Pezinho",
      description: "x",
      price: 10,
      duration: 15,
      active: true,
    });
  });
});

describe("preço fica gravado no agendamento", () => {
  it("mudar o preço depois não altera o faturamento antigo", async () => {
    const created = await book({
      phone: phone(10),
      serviceId: "barba",
      date: "2099-10-06",
      time: "09:00",
    });
    await api.adminSaveService({
      id: "barba",
      name: "Barba premium",
      description: "x",
      price: 99,
      duration: 30,
      active: true,
    });
    const [saved] = (await api.adminBookings({ from: "2099-10-06", to: "2099-10-06" })).filter(
      (b) => b.token === created.token,
    );
    expect(saved).toMatchObject({ serviceName: "Barba", price: 25 });
    const novo = await book({
      phone: phone(11),
      serviceId: "barba",
      date: "2099-10-06",
      time: "10:00",
    });
    expect(novo).toMatchObject({ serviceName: "Barba premium", price: 99 });
    await api.adminSaveService({
      id: "barba",
      name: "Barba",
      description: "x",
      price: 25,
      duration: 30,
      active: true,
    });
  });
});

describe("cancelar e remarcar pelo link", () => {
  it("cancelar libera o horário e não dá para cancelar duas vezes", async () => {
    const b = await book({ phone: phone(20), date: "2099-10-07", time: "09:00" });
    expect(await slotsOf("corte", "2099-10-07")).not.toContain("09:00");
    await api.cancel({ token: b.token });
    expect(await slotsOf("corte", "2099-10-07")).toContain("09:00");
    await fails(api.cancel({ token: b.token }));
    await fails(api.cancel({ token: "x".repeat(43) }), "NOT_FOUND");
    expect((await api.myBooking({ token: b.token }))?.status).toBe("cancelado");
  });

  it("remarcar: o próprio horário atual conta como livre e o novo vale a partir dali", async () => {
    const b = await book({
      phone: phone(21),
      serviceId: "combo",
      date: "2099-10-08",
      time: "10:00",
    });
    const days = await api.availability({ token: b.token, from: "2099-10-08", days: 1 });
    expect(days[0]!.slots).toContain("10:30"); // sobrepõe o próprio horário, mas é permitido
    const moved = await api.reschedule({ token: b.token, date: "2099-10-08", time: "10:30" });
    expect(moved).toMatchObject({ date: "2099-10-08", time: "10:30" });
    expect(await slotsOf("corte", "2099-10-08")).toContain("10:00");
    expect(await slotsOf("corte", "2099-10-08")).not.toContain("10:30");
  });

  it("remarcar para horário ocupado é recusado", async () => {
    const a = await book({ phone: phone(22), date: "2099-10-09", time: "09:00" });
    await book({ phone: phone(23), date: "2099-10-09", time: "09:30" });
    await fails(api.reschedule({ token: a.token, date: "2099-10-09", time: "09:30" }), "CONFLICT");
  });

  it("agendamento cancelado não pode ser remarcado", async () => {
    const b = await book({ phone: phone(24), date: "2099-10-09", time: "11:00" });
    await api.cancel({ token: b.token });
    await fails(api.reschedule({ token: b.token, date: "2099-10-09", time: "11:30" }));
  });
});

describe("privacidade", () => {
  it("a consulta por telefone só mostra serviço, dia e hora (nunca link, id ou nome)", async () => {
    const found = await api.lookup({ phone: phone(2) });
    expect(found.length).toBeGreaterThan(0);
    for (const item of found)
      expect(Object.keys(item).sort()).toEqual(["date", "serviceName", "time"]);
    expect(JSON.stringify(found)).not.toMatch(/token|Maria|id/i);
    expect(await api.lookup({ phone: "85911112222" })).toEqual([]);
  });

  it("o cliente não recebe o telefone do próprio agendamento nem dados de outros", async () => {
    const b = await book({ phone: phone(30), date: "2099-10-10", time: "09:00" });
    const mine = await api.myBooking({ token: b.token });
    expect(mine).not.toHaveProperty("phone");
    expect(mine).not.toHaveProperty("id");
    const info = await api.publicInfo();
    expect(Object.keys(info).sort()).toEqual(["services", "settings"]);
  });

  it("não dá para sobrescrever o agendamento de outra pessoa (não existe mais essa porta)", async () => {
    expect((api as Record<string, unknown>)["upsertBooking"]).toBeUndefined();
    expect((api as Record<string, unknown>)["saveDatabaseBooking"]).toBeUndefined();
  });
});

describe("painel do dono", () => {
  it("só aceita status válidos", async () => {
    const b = await book({ phone: phone(40), date: "2099-10-15", time: "09:00" });
    const [row] = (await api.adminBookings({ from: "2099-10-15", to: "2099-10-15" })).filter(
      (x) => x.token === b.token,
    );
    await fails(api.adminSetStatus({ id: row!.id, status: "hackeado" }));
    await api.adminSetStatus({ id: row!.id, status: "concluido" });
    expect((await api.myBooking({ token: b.token }))?.status).toBe("concluido");
    await fails(api.adminSetStatus({ id: "nao-existe", status: "faltou" }), "NOT_FOUND");
  });

  it("reabrir um cancelado cujo horário já foi ocupado dá erro amigável", async () => {
    const b = await book({ phone: phone(41), date: "2099-10-12", time: "09:00" });
    const [row] = (await api.adminBookings({ from: "2099-10-12", to: "2099-10-12" })).filter(
      (x) => x.token === b.token,
    );
    await api.adminSetStatus({ id: row!.id, status: "cancelado" });
    await book({ phone: phone(42), date: "2099-10-12", time: "09:00" });
    await fails(api.adminSetStatus({ id: row!.id, status: "agendado" }), "CONFLICT");
  });

  it("bloqueios tiram horários da lista e removê-los devolve", async () => {
    await api.adminAddBlock({
      date: "2099-10-13",
      start: "14:00",
      end: "16:00",
      reason: "Dentista",
    });
    const list = await slotsOf("corte", "2099-10-13");
    expect(list).not.toContain("14:00");
    expect(list).not.toContain("15:30");
    expect(list).toContain("16:00");
    const [block] = await api.adminBlocks({ from: "2099-10-13", to: "2099-10-13" });
    expect(block).toMatchObject({ reason: "Dentista", start: "14:00", end: "16:00" });
    await api.adminDeleteBlock({ id: block!.id });
    expect(await slotsOf("corte", "2099-10-13")).toContain("14:00");
    await fails(api.adminAddBlock({ date: "2099-10-13", start: "16:00", end: "15:00" }));
  });

  it("configurações: salva, valida e passa a valer nos horários", async () => {
    const original = await api.adminSettings();
    await fails(api.adminSaveSettings({ ...original, open: "20:00", close: "08:00" }));
    await api.adminSaveSettings({ ...original, open: "10:00", closedDays: [0, 1] });
    expect(await api.adminSettings()).toMatchObject({ open: "10:00", closedDays: [0, 1] });
    expect(await slotsOf("corte", "2099-10-14")).not.toContain("09:00"); // terça, abre às 10
    expect(
      (await api.availability({ serviceId: "corte", from: "2099-10-12", days: 1 }))[0]!.open,
    ).toBe(false); // segunda fechada
    await api.adminSaveSettings(original);
  });

  it("serviço: valida preço/duração/foto e cria novos", async () => {
    await fails(api.adminSaveService({ name: "Teste", price: 0, duration: 30 }));
    await fails(api.adminSaveService({ name: "Teste", price: 10, duration: 1 }));
    await fails(
      api.adminSaveService({
        name: "Teste",
        price: 10,
        duration: 30,
        photo: "javascript:alert(1)",
      }),
    );
    await api.adminSaveService({
      name: "Massagem",
      price: 27.5,
      duration: 20,
      photo: "/servicos/massagem.jpg",
    });
    const created = (await api.adminServices()).find((s) => s.name === "Massagem");
    expect(created).toMatchObject({
      price: 27.5,
      duration: 20,
      photo: "/servicos/massagem.jpg",
      active: true,
    });
  });
});

describe("regras gravadas no próprio banco", () => {
  it("recusa status inventado, telefone inválido e fim antes do início", async () => {
    const insert = (status: string, telefone: string) =>
      db.query(
        `INSERT INTO agendamentos (id, token, nome_cliente, telefone, servico_nome, preco_centavos, duracao_min, data, horario, status)
         VALUES ($1, $1, 'Teste', $2, 'X', 100, 30, '2099-11-01', '09:00', $3)`,
        [`id-${status}-${telefone}`, telefone, status],
      );
    await expect(insert("hackeado", "85999990000")).rejects.toThrow();
    await expect(insert("agendado", "123")).rejects.toThrow();
    await expect(
      db.query(
        `INSERT INTO bloqueios (id, data, inicio, fim) VALUES ('b', '2099-11-01', '10:00', '09:00')`,
      ),
    ).rejects.toThrow();
    const notNull = await db.query(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'data'`,
    );
    expect(notNull[0]?.is_nullable).toBe("NO");
  });
});
