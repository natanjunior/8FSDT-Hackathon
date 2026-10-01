/**
 * ============================================================================
 *  O QR na área — as decisões e as palavras (item 111)
 * ============================================================================
 *
 * **O QR aponta para a página do convite, com a área no parâmetro**: `/convite/{codigo}?area={id}`. A
 * página do convite é o único lugar que lê sem sessão (ADR-0018, lint `SEM_SESSAO`), e é ali que a face de
 * quem não entrou precisa do nome da organização. Uma rota própria do QR seria o terceiro arquivo da lista.
 *
 * **A área nunca é lida sem sessão.** Antes do login só se olha o formato dela; quem decide se ela existe é
 * o registro, dentro do escopo da organização ativa (`situacaoDaAreaInicial`).
 *
 * As funções são puras e têm teste em `testes/interface/qr-da-area.test.ts`.
 */

const FORMATO_DO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const TEXTOS_DO_QR = {
  naoEncontrado: {
    titulo: "QR não encontrado",
    corpo: "Confira se a etiqueta está inteira.",
    acao: "Ir para o início",
  },
  semSessao: {
    contexto: "Entre para registrar uma ocorrência neste lugar.",
    principal: "Entrar",
    apoio: "Ainda não participa? Peça para entrar. Um Gestor decide.",
    secundario: "Entrar na organização",
  },
  areaIndisponivel: "Esta área não está mais disponível. Escolha onde é.",
  trocando: "Abrindo o registro…",
  tituloDaAba: "QR da área",
} as const;

/**
 * O `?area=` do endereço: o primeiro, se repetido, aparado e **em minúscula**. Leitor de QR e encurtador
 * às vezes trocam a caixa, e o id do Postgres sai em minúscula. **Não valida formato**: `ehIdDeArea` faz.
 */
export function lerAreaDoEndereco(
  parametros: Record<string, string | string[] | undefined>,
): string | null {
  const bruto = parametros.area;
  const primeiro = Array.isArray(bruto) ? bruto[0] : bruto;
  const area = primeiro?.trim().toLowerCase() ?? "";
  return area === "" ? null : area;
}

export function ehIdDeArea(valor: string): boolean {
  return FORMATO_DO_ID.test(valor);
}

export type DestinoDoQr =
  | { tipo: "nao-encontrado" }
  | { tipo: "sem-sessao" }
  | { tipo: "convite"; para: string }
  | { tipo: "registro"; para: string }
  | { tipo: "trocar"; organizacaoId: string; para: string };

/**
 * **Para onde o QR leva**, a tabela da spec §3.2. Recebe só o que a página já tem: a leitura do convite e
 * a resolução de contexto. Nenhuma consulta.
 *
 * **`ja-participa` sem o vínculo na lista** só acontece numa corrida (o vínculo caiu entre as duas
 * leituras). O caso seguro é o convite, que diz a verdade sobre a situação.
 */
export function destinoDoQr(entrada: {
  convite: {
    codigoPublico: string;
    situacao: "sem-sessao" | "pode-pedir" | "ja-participa" | "pedido-pendente";
  } | null;
  areaId: string;
  ativaId: string | null;
  vinculos: readonly { organizacaoId: string; codigoPublico: string }[];
}): DestinoDoQr {
  const { convite, areaId, ativaId, vinculos } = entrada;
  if (convite === null || !ehIdDeArea(areaId)) return { tipo: "nao-encontrado" };

  const paraOConvite = { tipo: "convite", para: `/convite/${convite.codigoPublico}` } as const;
  const registro = `/ocorrencias/nova?area=${areaId}`;

  switch (convite.situacao) {
    case "sem-sessao":
      return { tipo: "sem-sessao" };
    case "pode-pedir":
    case "pedido-pendente":
      return paraOConvite;
    case "ja-participa": {
      const vinculo = vinculos.find((v) => v.codigoPublico === convite.codigoPublico);
      if (vinculo === undefined) return paraOConvite;
      if (vinculo.organizacaoId === ativaId) return { tipo: "registro", para: registro };
      return { tipo: "trocar", organizacaoId: vinculo.organizacaoId, para: registro };
    }
  }
}

export type SituacaoDaAreaInicial =
  | { tipo: "ausente" }
  | { tipo: "ativa"; areaId: string }
  | { tipo: "indisponivel" };

/**
 * **O que a área do QR é, dentro da organização ativa**, sobre as áreas dela, ativas e inativas.
 *
 * **Desativada, inexistente, de outra organização ou fora do formato dão o mesmo resultado**: o registro
 * abre sem área, com um aviso só (critérios 7 e 7a, decisão 12 do dono). O remédio é o mesmo, escolher onde
 * é, e um texto que distinguisse os casos confirmaria que aquele id é uma área real desta organização.
 */
export function situacaoDaAreaInicial(
  areas: readonly { id: string; ativa: boolean }[],
  areaId: string | null,
): SituacaoDaAreaInicial {
  if (areaId === null) return { tipo: "ausente" };
  const area = ehIdDeArea(areaId) ? areas.find((a) => a.id === areaId) : undefined;
  return area?.ativa === true ? { tipo: "ativa", areaId } : { tipo: "indisponivel" };
}
