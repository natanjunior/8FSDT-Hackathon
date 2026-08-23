import type { TipoArea } from "./TipoArea";

/**
 * **O que a POL-01 cria junto com a Organização** — `modelo-de-dados.md` §14.
 *
 * Mora no Domínio porque é **vocabulário fixado pelo enunciado**, não detalhe de armazenamento: a
 * Infraestrutura recebe estas listas e as insere, sem saber o que elas significam.
 *
 * > **O que a semente é, e o que ela não é.** Ela é **ponto de partida**, não resposta: a D18 existe
 * > porque *"qual categoria aparece antes é escolha do Gestor"*. Uma organização que nunca edite a
 * > semente é uma organização mal configurada — não um caso de uso previsto.
 */

export type CategoriaSemente = {
  readonly nome: string;
  readonly icone: string;
  readonly ordem: number;
};

export type AreaSemente = {
  readonly nome: string;
  readonly tipo: TipoArea;
  readonly ordem: number;
};

/**
 * O ícone gravado quando o cliente não manda nenhum (modelo §14.5).
 *
 * **Nenhuma das sete sementes o usa**, e isso é critério de aceitação: semente com ícone neutro apagaria
 * de saída a diferença que o item 4b existe para criar.
 */
export const ICONE_PADRAO = "tag";

/**
 * As sete do enunciado, na ordem em que ele as lista (§14.1).
 *
 * **Os nomes são cópia literal, e isso é deliberado:** nenhum foi encurtado, reordenado ou reescrito. O
 * enunciado lista oito marcadores; o oitavo é *"Outras situações definidas pelo grupo"*, que não é uma
 * categoria — é a licença que a D18 exerce ao tornar a lista configurável.
 *
 * > **Há três vocabulários em circulação para esta lista** — o `openapi.yaml` e o protótipo usam formas
 * > encurtadas, e dois deles divergem até no número (`Vazamentos` contra `Vazamento`). A §14.1 registra a
 * > divergência e **não decide**; esta lista segue a forma literal, que é a única com origem documentada
 * > e a que o critério de aceitação nomeia verbatim.
 *
 * `unplug` para *"Equipamentos quebrados"* é o único mapeamento que merece nota: é o aparelho fora do ar,
 * e não a ferramenta que o conserta — `wrench` está reservada para *"Solicitações de manutenção"*.
 */
export const CATEGORIAS_SEMENTE: readonly CategoriaSemente[] = Object.freeze([
  { nome: "Problemas de iluminação", icone: "lightbulb", ordem: 1 },
  { nome: "Equipamentos quebrados", icone: "unplug", ordem: 2 },
  { nome: "Falta de acessibilidade", icone: "accessibility", ordem: 3 },
  { nome: "Problemas de limpeza", icone: "trash-2", ordem: 4 },
  { nome: "Vazamentos", icone: "droplets", ordem: 5 },
  { nome: "Problemas de segurança", icone: "shield", ordem: 6 },
  { nome: "Solicitações de manutenção", icone: "wrench", ordem: 7 },
]);

/**
 * **Duas áreas, mínimas e neutras** — a saída (b) da §14.2, escolhida em 23/08/2026.
 *
 * O argumento é o da **D3**: o tenant é condomínio **ou** empresa **ou** bairro. Uma semente de
 * *Garagem · Hall · Salão de festas · Apartamento* está certa para um prédio e errada para um bairro, e o
 * multi-tenant é a adição `NOSSO` mais cara do projeto — semear o vocabulário de um só tipo de cliente o
 * contradiz na primeira tela que o Gestor abre.
 *
 * O único requisito real é que **nada nasça insubmissível**: sem categoria e sem área ativas ninguém
 * registra ocorrência (§6.5 e §6.6). Duas áreas o cumprem, e o resto é trabalho de T-09 — que é para onde
 * o estado vazio de T-03 já manda o Gestor.
 */
export const AREAS_SEMENTE: readonly AreaSemente[] = Object.freeze([
  { nome: "Área comum", tipo: "comum", ordem: 1 },
  { nome: "Unidade", tipo: "privativa", ordem: 2 },
]);
