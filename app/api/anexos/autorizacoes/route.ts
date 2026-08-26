import { autorizarUploadDeAnexo } from "@/aplicacao/anexo";
import { comContexto, portasDeAnexo, resposta } from "@/interface/http";
import { projetarAutorizacaoDeUpload } from "@/interface/projecoes";
import { pedidoDeAutorizacaoSchema } from "@/interface/schemas";

/**
 * **`POST /anexos/autorizacoes` — a credencial temporária de escrita.**
 *
 * A API **nunca recebe, nunca repassa e nunca guarda bytes de anexo** (contrato §10.1). Ela devolve duas
 * URLs assinadas e um ticket; o cliente sobe os bytes direto ao storage, e a validação acontece **na hora
 * de reivindicar** (item 13b), com `HEAD` no objeto.
 *
 * **Por que isto não passa por `POST /ocorrencias`.** O upload corre **em paralelo** com o preenchimento
 * do formulário — é o que faz o registro caber em menos de um minuto (RNF6, DG-5). O `POST /ocorrencias`
 * transporta 200 bytes de JSON em vez de 400 KB de foto.
 *
 * **É o único endpoint do contrato com limite de chamadas** — 30 por Pessoa por hora —, porque é o único
 * que permite a alguém autenticado consumir armazenamento externo **sem criar registro de domínio
 * nenhum**. Todos os outros criam linha em tabela e já esbarram nas regras do próprio domínio.
 *
 * **`portasDeAnexo()` é importada aqui e em nenhum outro arquivo**, e o `eslint.config.mjs` o garante.
 *
 * *Permissão: `ocorrencia.registrar` — Solicitante **e** Gestor, que acumula (§4.5).*
 */
export const POST = comContexto(
  { exige: "ocorrencia.registrar", corpo: pedidoDeAutorizacaoSchema },
  async ({ ctx, corpo }) =>
    resposta(
      projetarAutorizacaoDeUpload(
        await autorizarUploadDeAnexo(portasDeAnexo(), {
          organizacaoId: ctx.vinculo.organizacaoId,
          pessoaId: ctx.pessoaId,
          tipoConteudo: corpo.tipoConteudo,
          tamanhoBytes: corpo.tamanhoBytes,
        }),
      ),
      { status: 201 },
    ),
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
