import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { adminLoginSchema } from "@/lib/booking-rules";
import type { Block, Booking, DayAvailability, MyBooking, Service, Settings } from "@/lib/shop";
import { UserError, type ErrorCode, type PublicInfo } from "@/server/actions.server";
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  createSessionValue,
  loginBlocked,
  passwordMatches,
  registerLoginFailure,
  registerLoginSuccess,
  sessionIsValid,
} from "@/server/auth.server";
import { env, getActions } from "@/server/runtime.server";

// Todas as funções abaixo rodam SOMENTE no servidor. O navegador só recebe o resultado.
// Erros "esperados" voltam como { ok: false, error } com uma mensagem em português;
// qualquer outro erro é registrado no servidor e a pessoa vê uma mensagem genérica.

export type Result<T> =
  { ok: true; data: T } | { ok: false; error: string; code: ErrorCode | "INTERNAL" };

async function run<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, error: error.message, code: error.code };
    console.error("[erro]", error);
    const missingUrl = error instanceof Error && error.message.startsWith("DATABASE_URL");
    return {
      ok: false,
      code: "INTERNAL",
      error: missingUrl
        ? error.message
        : "O sistema está indisponível no momento. Tente novamente em instantes.",
    };
  }
}

const input = <T>(data: T) => data;
const actions = () => getActions();

// ====================== cliente ======================

export const getPublicInfo = createServerFn({ method: "GET" }).handler(
  (): Promise<Result<PublicInfo>> => run(async () => (await actions()).publicInfo()),
);

export const getAvailability = createServerFn({ method: "POST" })
  .validator(
    input<{
      serviceId?: string | undefined;
      token?: string | undefined;
      from: string;
      days: number;
    }>,
  )
  .handler(({ data }): Promise<Result<DayAvailability[]>> =>
    run(async () => (await actions()).availability(data)),
  );

export const createBooking = createServerFn({ method: "POST" })
  .validator(input<{ name: string; phone: string; serviceId: string; date: string; time: string }>)
  .handler(({ data }): Promise<Result<MyBooking>> =>
    run(async () => (await actions()).createBooking(data)),
  );

export const getMyBooking = createServerFn({ method: "POST" })
  .validator(input<{ token: string }>)
  .handler(({ data }): Promise<Result<MyBooking | null>> =>
    run(async () => (await actions()).myBooking(data)),
  );

export const cancelMyBooking = createServerFn({ method: "POST" })
  .validator(input<{ token: string }>)
  .handler(({ data }): Promise<Result<null>> =>
    run(async () => (await (await actions()).cancel(data), null)),
  );

export const rescheduleMyBooking = createServerFn({ method: "POST" })
  .validator(input<{ token: string; date: string; time: string }>)
  .handler(({ data }): Promise<Result<MyBooking>> =>
    run(async () => (await actions()).reschedule(data)),
  );

export const lookupBookings = createServerFn({ method: "POST" })
  .validator(input<{ phone: string }>)
  .handler(
    ({ data }): Promise<Result<Array<{ serviceName: string; date: string; time: string }>>> =>
      run(async () => (await actions()).lookup(data)),
  );

// ====================== painel do dono ======================

async function requireOwner() {
  const secret = env("ADMIN_SESSION_SECRET") ?? env("ADMIN_PASSWORD");
  if (!secret || !(await sessionIsValid(secret, getCookie(SESSION_COOKIE)))) {
    throw new UserError("Sua sessão expirou. Entre novamente.", "UNAUTH");
  }
}

/** Roda uma ação do painel só se o dono estiver logado. */
function owner<T>(work: () => Promise<T>): Promise<Result<T>> {
  return run(async () => {
    await requireOwner();
    return work();
  });
}

const clientKey = () =>
  getRequestHeader("cf-connecting-ip") ??
  getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
  "local";

export type OwnerSession = { configured: boolean; authed: boolean };

export const getOwnerSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<OwnerSession> => {
    const password = env("ADMIN_PASSWORD");
    const secret = env("ADMIN_SESSION_SECRET") ?? password;
    return {
      configured: !!password,
      authed: !!secret && (await sessionIsValid(secret, getCookie(SESSION_COOKIE))),
    };
  },
);

export const ownerLogin = createServerFn({ method: "POST" })
  .validator(input<{ password: string }>)
  .handler(({ data }): Promise<Result<null>> =>
    run(async () => {
      const password = env("ADMIN_PASSWORD");
      if (!password)
        throw new UserError(
          "Defina a variável ADMIN_PASSWORD no arquivo .env.local para usar o painel.",
        );
      const key = clientKey();
      if (loginBlocked(key))
        throw new UserError("Muitas tentativas. Aguarde alguns minutos e tente de novo.");

      const parsed = adminLoginSchema.safeParse(data);
      if (!parsed.success || !(await passwordMatches(parsed.data.password, password))) {
        registerLoginFailure(key);
        throw new UserError("Senha incorreta.");
      }
      registerLoginSuccess(key);
      setCookie(SESSION_COOKIE, await createSessionValue(env("ADMIN_SESSION_SECRET") ?? password), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env["NODE_ENV"] === "production",
        path: "/",
        maxAge: SESSION_SECONDS,
      });
      return null;
    }),
  );

export const ownerLogout = createServerFn({ method: "POST" }).handler(async (): Promise<null> => {
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return null;
});

export const ownerBookings = createServerFn({ method: "POST" })
  .validator(input<{ from: string; to: string }>)
  .handler(({ data }): Promise<Result<Booking[]>> =>
    owner(async () => (await actions()).adminBookings(data)),
  );

export const ownerSetStatus = createServerFn({ method: "POST" })
  .validator(input<{ id: string; status: string }>)
  .handler(({ data }): Promise<Result<null>> =>
    owner(async () => (await (await actions()).adminSetStatus(data), null)),
  );

export const ownerCreateBooking = createServerFn({ method: "POST" })
  .validator(input<{ name: string; phone: string; serviceId: string; date: string; time: string }>)
  .handler(({ data }): Promise<Result<Booking>> =>
    owner(async () => (await actions()).adminCreateBooking(data)),
  );

export const ownerBlocks = createServerFn({ method: "POST" })
  .validator(input<{ from: string; to: string }>)
  .handler(({ data }): Promise<Result<Block[]>> =>
    owner(async () => (await actions()).adminBlocks(data)),
  );

export const ownerAddBlock = createServerFn({ method: "POST" })
  .validator(input<{ date: string; start: string; end: string; reason: string }>)
  .handler(({ data }): Promise<Result<null>> =>
    owner(async () => (await (await actions()).adminAddBlock(data), null)),
  );

export const ownerDeleteBlock = createServerFn({ method: "POST" })
  .validator(input<{ id: string }>)
  .handler(({ data }): Promise<Result<null>> =>
    owner(async () => (await (await actions()).adminDeleteBlock(data), null)),
  );

export const ownerServices = createServerFn({ method: "GET" }).handler(
  (): Promise<Result<Service[]>> => owner(async () => (await actions()).adminServices()),
);

export const ownerSaveService = createServerFn({ method: "POST" })
  .validator(
    input<{
      id?: string | undefined;
      name: string;
      description: string;
      price: number;
      duration: number;
      active: boolean;
      photo?: string | undefined;
    }>,
  )
  .handler(({ data }): Promise<Result<null>> =>
    owner(async () => (await (await actions()).adminSaveService(data), null)),
  );

export const ownerSettings = createServerFn({ method: "GET" }).handler(
  (): Promise<Result<Settings>> => owner(async () => (await actions()).adminSettings()),
);

export const ownerSaveSettings = createServerFn({ method: "POST" })
  .validator(input<Settings>)
  .handler(({ data }): Promise<Result<null>> =>
    owner(async () => (await (await actions()).adminSaveSettings(data), null)),
  );
