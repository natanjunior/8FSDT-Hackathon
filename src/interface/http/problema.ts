import { ErroDeDominio } from "@/dominio/erros";

import { novoTraceId } from "./traco";

/**
 * ============================================================================
 *  RFC 9457 — `application/problem+json`
 * ============================================================================
 *
 * O corpo de erro uniforme do contrato (§6.1), com as três extensões nossas: `codigo`, `traceId`, `erros[]`.
 *
 * **A tabela de status vive aqui e não no domínio**, porque status HTTP é conhecimento de transporte e a
 * tabela de camadas proíbe o Domínio de conhecê-lo (arquitetura.md, Parte I §5). O `codigo` é o contrato de
 * verdade; o status é a tradução dele.
 */

/** A escada da §6.2 do contrato, materializada: `codigo` → status. */
const STATUS_POR_CODIGO: Readonly<Record<string, number>> = {
  // 400 · requisição mal formada — forma, rejeitada na Interface contra o schema
  FORMATO_INVALIDO: 400,
  // 401
  NAO_AUTENTICADO: 401,
  // 403 · posso ler, não posso executar
  SEM_ORGANIZACAO_ATIVA: 403,
  SEM_VINCULO_NA_ORGANIZACAO: 403,
  PERMISSAO_INSUFICIENTE: 403,
  SOMENTE_O_AUTOR_PODE_AVALIAR: 403,
  SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO: 403,
  // 404 · não posso ler o recurso (§6.3: recurso de outra organização responde como inexistente)
  OCORRENCIA_NAO_ENCONTRADA: 404,
  CATEGORIA_NAO_ENCONTRADA: 404,
  AREA_NAO_ENCONTRADA: 404,
  VINCULO_NAO_ENCONTRADO: 404,
  PEDIDO_NAO_ENCONTRADO: 404,
  CODIGO_PUBLICO_NAO_ENCONTRADO: 404,
  ANEXO_NAO_ENCONTRADO: 404,
  // 409 · posso executar, o estado atual não permite
  ORGANIZACAO_DIVERGENTE: 409,
  TRANSICAO_NAO_PERMITIDA: 409,
  RESPONSAVEL_NAO_ATRIBUIDO: 409,
  PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL: 409,
  AVALIACAO_EXIGE_RESOLVIDA: 409,
  JA_AVALIADA: 409,
  JA_VINCULADO: 409,
  PEDIDO_DE_ENTRADA_PENDENTE: 409,
  PEDIDO_JA_DECIDIDO: 409,
  PESSOA_COM_CONTA_NAO_EDITAVEL: 409,
  VINCULO_COM_HISTORICO: 409,
  ULTIMO_GESTOR: 409,
  CATEGORIA_NOME_DUPLICADO: 409,
  AREA_NOME_DUPLICADO: 409,
  ANEXO_JA_REIVINDICADO: 409,
  CONTATO_DUPLICADO: 409,
  // 415
  CORPO_NAO_SUPORTADO: 415,
  // 422 · requisição bem formada, valor inválido no domínio
  CATEGORIA_INVALIDA: 422,
  AREA_INVALIDA: 422,
  RESPONSAVEL_SEM_VINCULO_ATIVO: 422,
  MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL: 422,
  ANEXO_NAO_RECONHECIDO: 422,
  ANEXO_ACIMA_DO_LIMITE: 422,
  CAMPO_NAO_SUPORTADO: 422,
  // 429 · o único limite de chamadas do contrato (§10.3)
  LIMITE_DE_AUTORIZACOES_DE_UPLOAD: 429,
  // 500
  ERRO_INTERNO: 500,
};

/**
 * A URI de documentação do erro. *"Não precisa ser dereferenciável"* (RFC 9457 §3.1.1), e aponta para a
 * seção correspondente do contrato.
 */
function tipoDoErro(codigo: string): string {
  return `https://resolveai.app/erros/${codigo.toLowerCase().replace(/_/gu, "-")}`;
}

/** Uma violação de campo — só em `400` (contrato §6.1). */
export type ErroDeCampo = {
  campo: string;
  codigo: string;
  mensagem?: string;
};

/** `415 CORPO_NAO_SUPORTADO` — `Content-Type` diferente de `application/json`. */
export class CorpoNaoSuportado extends ErroDeDominio {
  constructor(recebido: string | null) {
    super(
      "CORPO_NAO_SUPORTADO",
      "Corpo não suportado",
      `Esta operação aceita application/json${recebido === null ? "" : `; recebido: ${recebido}`}.`,
    );
  }
}

/** `400 FORMATO_INVALIDO` — schema violado; `erros[]` detalha por campo. */
export class FormatoInvalido extends ErroDeDominio {
  constructor(erros: readonly ErroDeCampo[]) {
    super("FORMATO_INVALIDO", "Formato inválido", "Um ou mais campos estão inválidos.", { erros });
  }
}

/** `409 ORGANIZACAO_DIVERGENTE` — `X-Organizacao-Id` diferente da organização ativa (contrato §4.3). */
export class OrganizacaoDivergente extends ErroDeDominio {
  constructor() {
    super(
      "ORGANIZACAO_DIVERGENTE",
      "Organização divergente",
      "Esta aba está em outra organização. Recarregue a página antes de continuar.",
    );
  }
}

/**
 * Constrói a resposta de erro.
 *
 * @param instancia o caminho da requisição que falhou.
 * @returns o corpo e o status. **Nenhum código de erro expõe nome de tabela, coluna, SQL ou identificador
 *          de outra organização** — é regra de contrato (§6.4), e o que a sustenta é que o `detalhe` sempre
 *          vem do erro nomeado, nunca da mensagem do banco.
 */
export function problemaDe(
  erro: unknown,
  instancia: string,
  traceId: string = novoTraceId(),
): { status: number; corpo: Record<string, unknown> } {
  if (erro instanceof ErroDeDominio) {
    const status = STATUS_POR_CODIGO[erro.codigo] ?? 500;
    return {
      status,
      corpo: {
        type: tipoDoErro(erro.codigo),
        title: erro.titulo,
        status,
        detail: erro.detalhe,
        instance: instancia,
        codigo: erro.codigo,
        traceId,
        ...erro.extensoes,
      },
    };
  }

  // Desconhecido: `500 ERRO_INTERNO`, **sem `detail` de domínio; só `traceId`** (contrato §6.4). A causa
  // vai para o log, onde só o operador chega.
  return {
    status: 500,
    corpo: {
      type: tipoDoErro("ERRO_INTERNO"),
      title: "Erro interno",
      status: 500,
      instance: instancia,
      codigo: "ERRO_INTERNO",
      traceId,
    },
  };
}

/** A resposta HTTP de erro, com o `Content-Type` que a RFC 9457 exige. */
export function respostaDeProblema(
  erro: unknown,
  instancia: string,
  traceId: string,
): Response {
  const { status, corpo } = problemaDe(erro, instancia, traceId);
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  });
}
