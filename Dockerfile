# =============================================================================
#  Resolve Aí — a imagem que roda local E em produção
#
#  **É o mesmo artefato nos dois lugares**, e essa é a razão inteira da
#  ADR-0004: enquanto o `Dockerfile` servia só ao desenvolvimento, o E7 do
#  enunciado era uma divergência declarada. Aqui ele deixa de ser.
#
#  ---------------------------------------------------------------------------
#   Nenhum segredo, e nenhuma configuração
#  ---------------------------------------------------------------------------
#
#  A imagem é **pública** no `ghcr.io`, e o que entra numa camada permanece
#  legível **mesmo que um `RUN rm` apague o arquivo depois**. Por isso:
#
#    · não há `ARG` neste arquivo, nem um;
#    · o `.dockerignore` exclui `.env` e `.env.*` antes de qualquer `COPY`;
#    · não existe variável `NEXT_PUBLIC_*` no projeto, então **nada é embutido
#      no bundle em tempo de build** — o SDK do provedor roda no servidor.
#
#  Consequência verificável: `docker history` e `docker run … env` nesta imagem
#  não mostram uma única variável do projeto. As quatro chegam como ambiente do
#  Container App, em tempo de execução.
# =============================================================================

# -----------------------------------------------------------------------------
# 1 · Dependências. Estágio próprio para que o cache sobreviva a mudança de
#     código: só `package*.json` entra aqui.
# -----------------------------------------------------------------------------
FROM node:24-alpine AS dependencias

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts


# -----------------------------------------------------------------------------
# 2 · Construção. `output: "standalone"` (next.config.ts) faz o Next produzir
#     um `server.js` com só o que ele precisa — é o que mantém a imagem final
#     pequena e o cold start do RNF5 curto.
# -----------------------------------------------------------------------------
FROM node:24-alpine AS construcao

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencias /app/node_modules ./node_modules
COPY . .

RUN npm run build


# -----------------------------------------------------------------------------
# 3 · Execução. Nem `node_modules` de desenvolvimento, nem código-fonte, nem
#     testes, nem `docs/` — só a saída standalone.
# -----------------------------------------------------------------------------
FROM node:24-alpine AS execucao

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Não roda como root. É a única linha deste arquivo que não vem de decisão
# escrita no pacote — e vale por si: a imagem é pública, e quem a executa não
# precisa dar root a ela. [FONTE EXTERNA]
RUN addgroup --system --gid 1001 resolveai \
 && adduser  --system --uid 1001 --ingroup resolveai resolveai

COPY --from=construcao --chown=resolveai:resolveai /app/public ./public
COPY --from=construcao --chown=resolveai:resolveai /app/.next/standalone ./
COPY --from=construcao --chown=resolveai:resolveai /app/.next/static ./.next/static

USER resolveai

EXPOSE 3000

# `/entrar` é a tela pública (T-01). Ela não toca o banco — sem cookie, a
# resolução de contexto recusa antes de qualquer consulta — mas **exige**
# `SUPABASE_URL` e `SUPABASE_CHAVE_ANONIMA`, então container mal configurado
# responde 500 e aparece como doente. Que é o comportamento desejado.
#
# Não há endpoint de saúde inventado: o contrato de API tem 41 operações e
# nenhuma delas é `/health`. Acrescentar uma seria API que ninguém pediu.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/entrar').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
