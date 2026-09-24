import { listarOcorrencias, registrarOcorrencia } from "@/aplicacao/ocorrencia";
import {
  CampoNaoSuportado,
  armazenamentoDeAnexos,
  comContexto,
  lerPaginacaoDaUrl,
  lerFiltroDeOcorrenciasDaUrl,
  lerLimiteDaUrl,
  lerOrdenacaoDeOcorrenciasDaUrl,
  resposta,
} from "@/interface/http";
import {
  lenteDeRotulo,
  projetarOcorrenciaDetalhe,
  projetarPaginaDeOcorrencias,
} from "@/interface/projecoes";
import { camposEscritosPeloServidor, registroDeOcorrenciaSchema } from "@/interface/schemas";

/**
 * A recusa dos cinco campos do critério 11.3, **antes** da validação de forma.
 *
 * A ordem importa: quem enviou `status: "resolvida"` junto com um título vazio precisa saber que o
 * produto não aceita o primeiro, e não só que o segundo está errado.
 */
function recusarEscritosPeloServidor(corpo: unknown): void {
  const proibidos = camposEscritosPeloServidor(corpo);
  if (proibidos.length > 0) throw new CampoNaoSuportado(proibidos);
}

/**
 * **`POST /ocorrencias`** — registra a ocorrência **e grava o primeiro registro da trilha**, com
 * `statusAnterior` nulo (premissa P1). Ele volta na resposta, em `ultimaTransicao`.
 *
 * **Três coisas o servidor escreve e o cliente não pode enviar:** `status` (nasce `aberta`), `prioridade`
 * (nasce `normal`, D6) e `areaTipo` (a cópia congelada que decide a visibilidade para sempre). E uma
 * quarta, que é o requisito central do desafio: o registro de transição.
 *
 * **E o anexo é reivindicado aqui, na mesma transação.** `anexos: [{chave, ticket}]` chega como
 * referência a um objeto que já subiu ao storage; o servidor confere o ticket, lê o objeto, troca a
 * etiqueta para `confirmado` e grava a terceira linha do mesmo `COMMIT`. Nenhum byte de anexo atravessa
 * este contêiner (contrato §10.1).
 *
 * *Permissão: `ocorrencia.registrar` — Solicitante **e** Gestor, que acumula (§4.5).*
 */
export const POST = comContexto(
  // **`corpo:`, nao `schema:`** — e o nome que `OpcoesEscopadas` tem hoje, e e o que
  // `POST /categorias` e `PATCH /vinculos` ja usam.
  {
    exige: "ocorrencia.registrar",
    corpo: registroDeOcorrenciaSchema,
    recusar: recusarEscritosPeloServidor,
  },
  async ({ ctx, repos, corpo }) => {
    const lida = await registrarOcorrencia(
      // **`repos` mais uma porta que não é repositório escopado.** `RepositoriosEscopados` continua sem
      // membro que não seja repositório escopado — quem junta as duas coisas é o anel externo, que é
      // quem monta (ADR-0005).
      { ...repos, armazenamento: armazenamentoDeAnexos() },
      { pessoaId: ctx.pessoaId, organizacaoId: ctx.vinculo.organizacaoId },
      corpo,
    );

    return resposta(
      projetarOcorrenciaDetalhe(lida, {
        pessoaId: ctx.pessoaId,
        permissoes: ctx.vinculo.permissoes,
      }),
      { status: 201, cabecalhos: { Location: `/api/ocorrencias/${lida.id}` } },
    );
  },
);

/**
 * **`GET /ocorrencias`** — a mesma URL, conjuntos diferentes conforme quem pergunta (contrato §8.5).
 *
 * **A permissão exigida é `ocorrencia.ler_propria`, e não é engano.** O contrato diz *"`ler_todas` **ou**
 * `ler_propria`"*, e `comContexto` aceita **uma**. Não há caso a resolver: o Gestor **acumula** as do
 * Solicitante (§4.5), então `ler_propria` é verdadeira para os dois papéis que leem, e falsa só para o
 * `encarregado` — que é justamente quem tem de levar `403`. Qual dos dois conjuntos volta é decidido
 * **depois**, por `ler_todas`, e sai declarado em `visibilidadeAplicada`.
 *
 * **Os sete filtros são do item 15 e do 67**, e o endpoint não os gateia por permissão: o contrato não o
 * faz (§8.5), e quem só tem `ler_propria` já recebe apenas as próprias — filtrar dentro disso é legítimo.
 * **O que é de permissão é a barra na tela**, não o parâmetro na URL.
 *
 * **`ordem` e `sentido` não são filtro nem paginação** (item 67): não recortam, então não entram em
 * `FiltroDeOcorrencias` e não alcançam contagem nenhuma.
 *
 * *Capacidades: listar todas da organização · `ENUNCIADO · aberto` (G1).*
 */
export const GET = comContexto({ exige: "ocorrencia.ler_propria" }, async ({ ctx, repos, requisicao }) => {
  const consulta = new URL(requisicao.url).searchParams;
  const filtro = lerFiltroDeOcorrenciasDaUrl(consulta);
  // **A paginação é numerada sobre um instante de corte** desde o item 14b (09/09/2026): `pagina`, `ate`
  // e `totalNoCorte` no lugar do `cursor`. Os três são de paginação e **não** entram no filtro — é o
  // critério `14b.9`, e é o que faz o *Voltar* de T-05 devolver a lista filtrada na página 1.
  const paginacao = lerPaginacaoDaUrl(consulta);
  const ordenacao = lerOrdenacaoDeOcorrenciasDaUrl(consulta);

  const pagina = await listarOcorrencias(
    repos.ocorrencias,
    { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") },
    {
      limite: lerLimiteDaUrl(requisicao),
      ...paginacao,
      filtro,
      ...(ordenacao === undefined ? {} : { ordenacao }),
    },
  );

  // **A mesma permissão que decidiu o CONJUNTO decide a COLUNA** — `ocorrencia.ler_todas`, e é o
  // predicado único do item 31. Nenhuma consulta a mais: `ctx.vinculo` já está na mão.
  return projetarPaginaDeOcorrencias(pagina, lenteDeRotulo(ctx.vinculo.permissoes));
});

export const dynamic = "force-dynamic";
