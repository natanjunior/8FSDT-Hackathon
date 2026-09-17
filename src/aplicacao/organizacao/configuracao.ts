import { ICONE_PADRAO, type TipoArea } from "@/dominio/organizacao";

import {
  AreaNaoEncontrada,
  CategoriaNaoEncontrada,
  ListaDesatualizada,
  NomeDeAreaDuplicado,
  NomeDeCategoriaDuplicado,
} from "./erros";
import type {
  AreaAtualizada,
  AreaLida,
  CategoriaLida,
  OrganizacaoLida,
  PosicaoNaLista,
  RepositorioEscopadoDaOrganizacao,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
} from "./portas";

/**
 * ============================================================================
 *  A configuração da organização — itens 4a, 5, 46 · 47 e 50 (T-09, T-14 e T-15)
 * ============================================================================
 *
 * **Os dois padrões de produto moram aqui, e não no schema de entrada.** É a mesma doutrina que
 * `consultas.ts` escreveu para o *"só as ativas"*: o padrão não é convenção de HTTP — é a regra que o
 * `openapi.yaml` escreve por extenso (*"o servidor grava `tag` quando o cliente não manda"*, §14.5 do
 * modelo; `ordem` ausente é *no fim*, desde o item 50). A Interface traduz o corpo; **quem sabe o que
 * acontece quando ninguém manda nada é esta camada.**
 *
 * **Nenhuma das sete funções abre transação.** As cinco primeiras são uma instrução só. As duas
 * reordenações precisam de uma, e quem a abre é a porta, que recebe a transação escopada (ADR-0003):
 * esta camada decide, a porta transcreve com predicado.
 */

export type ComandoDeNovaCategoria = {
  nome: string;
  icone?: string;
  ordem?: number;
  /** Quem está criando — `ctx.pessoaId`. Vai para a coluna de auditoria de configuração (modelo §6.5). */
  porPessoaId: string;
};

export async function criarCategoria(
  categorias: RepositorioEscopadoDeCategorias,
  comando: ComandoDeNovaCategoria,
): Promise<CategoriaLida> {
  const resultado = await categorias.criar({
    nome: comando.nome,
    // **Nunca nulo, e é aqui que isso se decide.** A coluna é `NOT NULL` e o schema `Categoria` traz
    // `icone` como `required` — nenhuma tela precisa de caminho para ausência (contrato §8.1).
    icone: comando.icone ?? ICONE_PADRAO,
    // **Sem `ordem`, o fim da lista** (item 50, spec §4.3). A intenção vai à porta, e o número sai do
    // banco na própria instrução do `insert`.
    ordem: comando.ordem ?? "no-fim",
    criadaPorPessoaId: comando.porPessoaId,
  });

  if (resultado.desfecho === "nome-duplicado") throw new NomeDeCategoriaDuplicado();
  return resultado.categoria;
}

export type ComandoDeCorrecaoDeCategoria = {
  categoriaId: string;
  nome?: string;
  icone?: string;
  ordem?: number;
  ativa?: boolean;
  porPessoaId: string;
};

export async function corrigirCategoria(
  categorias: RepositorioEscopadoDeCategorias,
  comando: ComandoDeCorrecaoDeCategoria,
): Promise<CategoriaLida> {
  // Campo ausente **não** vai para a porta: ausência é *não mexa*, e mandá-la como `undefined` explícito
  // faria o repositório escrever uma atribuição que ninguém pediu.
  const resultado = await categorias.corrigir({
    categoriaId: comando.categoriaId,
    ...(comando.nome === undefined ? {} : { nome: comando.nome }),
    ...(comando.icone === undefined ? {} : { icone: comando.icone }),
    ...(comando.ordem === undefined ? {} : { ordem: comando.ordem }),
    ...(comando.ativa === undefined ? {} : { ativa: comando.ativa }),
    atualizadaPorPessoaId: comando.porPessoaId,
  });

  if (resultado.desfecho === "nao-encontrada") throw new CategoriaNaoEncontrada();
  if (resultado.desfecho === "nome-duplicado") throw new NomeDeCategoriaDuplicado();
  return resultado.categoria;
}

export type ComandoDeNovaArea = {
  nome: string;
  tipo: TipoArea;
  ordem?: number;
  porPessoaId: string;
};

export async function criarArea(
  areas: RepositorioEscopadoDeAreas,
  comando: ComandoDeNovaArea,
): Promise<AreaLida> {
  const resultado = await areas.criar({
    nome: comando.nome,
    // **`tipo` não tem padrão, e é o único campo obrigatório desta camada que não o tem.** Um padrão
    // implícito escolheria a visibilidade da ocorrência em silêncio (D10).
    tipo: comando.tipo,
    // **Sem `ordem`, o fim da lista** (item 50, spec §4.3). A intenção vai à porta, e o número sai do
    // banco na própria instrução do `insert`.
    ordem: comando.ordem ?? "no-fim",
    criadaPorPessoaId: comando.porPessoaId,
  });

  if (resultado.desfecho === "nome-duplicado") throw new NomeDeAreaDuplicado();
  return resultado.area;
}

export type ComandoDeCorrecaoDeArea = {
  areaId: string;
  nome?: string;
  tipo?: TipoArea;
  ordem?: number;
  ativa?: boolean;
  porPessoaId: string;
};

export async function corrigirArea(
  areas: RepositorioEscopadoDeAreas,
  comando: ComandoDeCorrecaoDeArea,
): Promise<AreaAtualizada> {
  const resultado = await areas.corrigir({
    areaId: comando.areaId,
    ...(comando.nome === undefined ? {} : { nome: comando.nome }),
    ...(comando.tipo === undefined ? {} : { tipo: comando.tipo }),
    ...(comando.ordem === undefined ? {} : { ordem: comando.ordem }),
    ...(comando.ativa === undefined ? {} : { ativa: comando.ativa }),
    atualizadaPorPessoaId: comando.porPessoaId,
  });

  if (resultado.desfecho === "nao-encontrada") throw new AreaNaoEncontrada();
  if (resultado.desfecho === "nome-duplicado") throw new NomeDeAreaDuplicado();
  return resultado.area;
}

export type ComandoDeCorrecaoDeOrganizacao = {
  nome?: string;
  /** Quem está corrigindo — `ctx.pessoaId`. Vai para a coluna de auditoria (modelo §6.5). */
  porPessoaId: string;
};

/**
 * **Corrigir a organização ativa — item 46 · 47.**
 *
 * **O quinto caso de uso deste arquivo, e o único sem recusa a traduzir.** Os outros quatro convertem
 * desfecho da porta em erro nomeado do contrato; aqui não há desfecho: a organização é a da sessão, ela
 * existe, e não há unicidade de nome a violar (spec §3.3).
 *
 * **Ele existe mesmo assim porque a fronteira é a mesma:** `app/` não monta repositório (ADR-0006, regra
 * 2b), e o handler chama **uma** função desta camada. O que se traduz é o vocabulário — o comando fala
 * `porPessoaId`, a porta fala `atualizadaPorPessoaId`.
 *
 * **O spread e não `nome: comando.nome`:** a chave ausente é o que diz *"não altere"*. Quem monta o
 * `update` decide pela ausência, e uma chave presente valendo `undefined` é uma terceira coisa que
 * ninguém precisa que exista.
 */
export async function corrigirOrganizacao(
  organizacao: RepositorioEscopadoDaOrganizacao,
  comando: ComandoDeCorrecaoDeOrganizacao,
): Promise<OrganizacaoLida> {
  return organizacao.corrigir({
    ...(comando.nome === undefined ? {} : { nome: comando.nome }),
    atualizadaPorPessoaId: comando.porPessoaId,
  });
}

export type ComandoDeReordenacao = {
  /** A lista inteira da organização, ativas e inativas, na ordem desejada. */
  ids: readonly string[];
  /** Quem reordena — `ctx.pessoaId`. Vai para `atualizado_por_pessoa_id` das linhas que mudarem. */
  porPessoaId: string;
};

/**
 * **Reordenar as categorias — item 50, `PUT /categorias/ordem`.**
 *
 * A forma é a de `aplicarTransicao` (`aplicacao/ocorrencia/portas.ts`): **lê, decide, grava com
 * predicado.** A regra do conjunto mora aqui; a porta a repete sobre as linhas que travou, porque um item
 * criado entre esta leitura e a escrita derruba a premissa da decisão (spec §4.7). As duas recusas são a
 * mesma, para quem chama.
 */
export async function reordenarCategorias(
  categorias: RepositorioEscopadoDeCategorias,
  comando: ComandoDeReordenacao,
): Promise<readonly CategoriaLida[]> {
  const atuais = await categorias.listar({ apenasAtivas: false });
  const resultado = await categorias.reordenar({
    posicoes: posicoesDaReordenacao(atuais, comando.ids),
    atualizadaPorPessoaId: comando.porPessoaId,
  });

  if (resultado.desfecho === "lista-desatualizada") throw new ListaDesatualizada();
  return resultado.itens;
}

/** **Reordenar as áreas — item 50, `PUT /areas/ordem`.** A mesma forma e a mesma regra. */
export async function reordenarAreas(
  areas: RepositorioEscopadoDeAreas,
  comando: ComandoDeReordenacao,
): Promise<readonly AreaLida[]> {
  const atuais = await areas.listar({ apenasAtivas: false });
  const resultado = await areas.reordenar({
    posicoes: posicoesDaReordenacao(atuais, comando.ids),
    atualizadaPorPessoaId: comando.porPessoaId,
  });

  if (resultado.desfecho === "lista-desatualizada") throw new ListaDesatualizada();
  return resultado.itens;
}

/**
 * **A regra do conjunto:** a lista pedida tem de ser uma permutação da lista atual.
 *
 * Faltando, sobrando, repetido, de outra organização ou inexistente dão **a mesma recusa** (spec §4.1).
 * Pela rota, o repetido para antes, no schema; aqui ele é defesa, e o teste de unidade o exercita.
 *
 * **A comparação é em minúsculas** (spec §4.9). O schema já normaliza, e esta função não confia nisso: o
 * Postgres devolve `uuid` em minúsculas, e um id em maiúsculas seria recusado sendo correto.
 */
function posicoesDaReordenacao(
  atuais: readonly { id: string }[],
  pedidos: readonly string[],
): PosicaoNaLista[] {
  const conjuntoAtual = new Set(atuais.map((item) => item.id.toLowerCase()));
  const normalizados = pedidos.map((id) => id.toLowerCase());
  const ehPermutacao =
    normalizados.length === conjuntoAtual.size &&
    new Set(normalizados).size === normalizados.length &&
    normalizados.every((id) => conjuntoAtual.has(id));

  if (!ehPermutacao) throw new ListaDesatualizada();
  return normalizados.map((id, indice) => ({ id, ordem: indice + 1 }));
}
