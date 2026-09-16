import { ICONE_PADRAO, type TipoArea } from "@/dominio/organizacao";

import {
  AreaNaoEncontrada,
  CategoriaNaoEncontrada,
  NomeDeAreaDuplicado,
  NomeDeCategoriaDuplicado,
} from "./erros";
import type {
  AreaAtualizada,
  AreaLida,
  CategoriaLida,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
} from "./portas";

/**
 * ============================================================================
 *  A configuração da organização — itens 4a e 5 (T-09 e T-14)
 * ============================================================================
 *
 * **Os dois padrões de produto moram aqui, e não no schema de entrada.** É a mesma doutrina que
 * `consultas.ts` escreveu para o *"só as ativas"*: o padrão não é convenção de HTTP — é a regra que o
 * `openapi.yaml` escreve por extenso (*"o servidor grava `tag` quando o cliente não manda"*, §14.5 do
 * modelo; `ordem` com `default: 0`). A Interface traduz o corpo; **quem sabe o que acontece quando
 * ninguém manda nada é esta camada.**
 *
 * **Nenhuma das quatro funções abre transação, e nenhuma precisa:** cada uma é uma instrução só. É o que
 * separa esta fatia do cadastro de vínculo, que escreve Pessoa e Vínculo juntos.
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
    ordem: comando.ordem ?? 0,
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
    ordem: comando.ordem ?? 0,
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
