# Zé Filho Barbeiro — Agendamento

Site de agendamento da barbearia Zé Filho Barbeiro. O cliente escolhe o serviço, o dia e o horário; o dono acompanha tudo em um painel protegido por senha. Os dados ficam em um banco **Neon (PostgreSQL)**.

## Telas

| Endereço | Para quem | O que faz |
| --- | --- | --- |
| `/` | Cliente | Escolher serviço, dia e horário e confirmar o agendamento |
| `/agendamento/<link secreto>` | Cliente | Ver, remarcar ou cancelar o próprio horário |
| `/meu-agendamento` | Cliente | Consultar os próximos horários pelo WhatsApp (mostra só serviço, dia e hora) |
| `/admin` | Dono | Agenda, agendar cliente, lembretes, bloqueios, serviços, configurações e relatório |

## Como rodar (primeira vez)

1. Crie um projeto grátis em [neon.tech](https://neon.tech) e copie a **Connection string** (botão *Connect*).
2. Na pasta do projeto, copie `.env.example` para `.env.local` e preencha:
   - `DATABASE_URL`: a connection string do Neon;
   - `ADMIN_PASSWORD`: a senha do painel `/admin` (10 caracteres ou mais).
3. Instale e rode:

   ```sh
   npm install
   npm run dev      # abre em http://localhost:8080
   ```

**O banco é criado sozinho.** Assim que o servidor liga, ele conecta no Neon e cria as tabelas e os serviços iniciais (você vê `[banco] pronto` no terminal). Não existe nenhum comando de banco para rodar. Isso só acontece uma vez: nas próximas vezes ele apenas confere e segue, e **nunca sobrescreve** o que você alterou no painel.

> Nunca envie o `.env.local` para o GitHub nem compartilhe: ele contém a senha do banco. Se vazar, troque a senha no painel do Neon (*Roles → Reset password*).

## O que o sistema garante

- **Sem horário duplicado:** o próprio banco recusa dois agendamentos que se sobrepõem, mesmo que dois clientes cliquem ao mesmo tempo.
- **O servidor decide:** expediente, almoço, bloqueios, folgas, horário passado e limite de 60 dias são conferidos no servidor, não só na tela.
- **Preço fica gravado:** mudar o preço de um serviço não altera o faturamento dos atendimentos já marcados.
- **Privacidade:** o cliente só enxerga o próprio agendamento, pelo link secreto. Nunca aparecem nome ou telefone de outras pessoas.
- **Painel protegido:** só entra quem tem a senha (cookie assinado, válido por 7 dias, e bloqueio depois de 5 senhas erradas). A API do painel recusa quem não fez login.
- Cada telefone pode ter até 3 agendamentos futuros ao mesmo tempo (evita agendamentos falsos em massa).

## Fotos dos serviços

Veja `public/servicos/LEIA-ME.txt`. Sem foto, o serviço mostra um ícone de tesoura.

## Dados da barbearia

WhatsApp, endereço e Instagram que aparecem no site ficam em `src/lib/shop-info.ts`. Horário de funcionamento, almoço, folgas e serviços são editados no painel `/admin`.

## Comandos

```sh
npm run dev       # desenvolvimento
npm run build     # versão de produção
npm run test      # testes (incluem um PostgreSQL de teste em memória; não usam o seu Neon)
npm run lint
```

## Estrutura

- `src/server/` — tudo que roda só no servidor: banco (`repo`), regras (`actions`), tabelas (`migrations`) e login (`auth`).
- `src/lib/api.functions.ts` — as funções que as telas chamam (cliente e painel).
- `src/lib/booking-rules.ts` — regras de horário e validação dos dados.
- `src/components/` e `src/routes/` — as telas.

Para mudar o banco no futuro, acrescente uma nova migração no fim de `src/server/migrations.server.ts` (nunca edite uma que já rodou).

## Publicação

O build gera a saída para Cloudflare por padrão; para outro destino rode o build com `NITRO_PRESET=<destino>` (ex.: `vercel`, `node-server`). Na hospedagem, cadastre `DATABASE_URL` e `ADMIN_PASSWORD` como variáveis de ambiente (o `.env.local` não vai junto). A publicação ainda não foi testada.
