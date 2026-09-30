import type {
  AreaAtualizada,
  AreaLida,
  CategoriaLida,
  ChaveDeConfiguracao,
  ConfiguracaoLida,
  OrganizacaoCriada,
  OrganizacaoLida,
} from "@/aplicacao/organizacao";

/**
 * As projeções dos schemas `Organizacao`, `Categoria` e `Area` do `openapi.yaml`.
 *
 * Moram na camada de Interface pela mesma razão que `projetarContexto`: há **dois transportes** para a
 * mesma leitura (contrato §5), e uma projeção no handler não existiria para o Server Component.
 *
 * **Elas são o filtro que impede a forma do banco de subir.** `organizacao_id`, `criado_por_pessoa_id`,
 * `atualizado_em` e `logo_caminho` existem no esquema e **não aparecem em resposta nenhuma** — não porque
 * alguém se lembrou de omiti-los, mas porque estes tipos não os têm.
 */

export type OrganizacaoProjetada = {
  id: string;
  nome: string;
  codigoPublico: string;
  criadoEm: string;
  categoriasSemeadas: number;
  areasSemeadas: number;
};

/** O schema `OrganizacaoResumo` do contrato — o que `PATCH /organizacoes` devolve. */
export type OrganizacaoResumoProjetada = {
  id: string;
  nome: string;
  codigoPublico: string;
};

export type CategoriaProjetada = {
  id: string;
  nome: string;
  icone: string;
  ativa: boolean;
  ordem: number;
};

export type AreaProjetada = {
  id: string;
  nome: string;
  tipo: string;
  ativa: boolean;
  ordem: number;
};

export function projetarOrganizacao(criada: OrganizacaoCriada): OrganizacaoProjetada {
  return {
    id: criada.id,
    nome: criada.nome,
    codigoPublico: criada.codigoPublico,
    criadoEm: criada.criadoEm,
    categoriasSemeadas: criada.categoriasSemeadas,
    areasSemeadas: criada.areasSemeadas,
  };
}

/**
 * **`OrganizacaoResumo`, e não `Organizacao`** (spec §3.11): aquele carrega `criadoEm` e as duas
 * contagens de semente, e **semente não acontece num `PATCH`**. Devolvê-las com `0` seria dizer que nada
 * foi semeado; devolvê-las com o número real custaria duas consultas para responder a pergunta errada.
 */
export function projetarOrganizacaoResumo(lida: OrganizacaoLida): OrganizacaoResumoProjetada {
  return { id: lida.id, nome: lida.nome, codigoPublico: lida.codigoPublico };
}

export function projetarCategoria(categoria: CategoriaLida): CategoriaProjetada {
  return {
    id: categoria.id,
    nome: categoria.nome,
    // `icone` é `required` no schema e `NOT NULL` na coluna: **nunca vem nulo**, e nenhuma tela precisa
    // de caminho para ausência (contrato §8.1).
    icone: categoria.icone,
    ativa: categoria.ativa,
    ordem: categoria.ordem,
  };
}

export function projetarArea(area: AreaLida): AreaProjetada {
  return {
    id: area.id,
    nome: area.nome,
    // O tipo **vigente**. O congelado é `areaTipo`, e mora na ocorrência (emenda à D10).
    tipo: area.tipo,
    ativa: area.ativa,
    ordem: area.ordem,
  };
}

export type AreaAtualizadaProjetada = AreaProjetada & { ocorrenciasComTipoAnterior: number };

/**
 * A resposta de `PATCH /areas/{id}` — o schema `Area` **mais** a contagem.
 *
 * Ela é um `allOf` no `openapi.yaml`, e é o único ponto do contrato em que a escrita devolve mais que o
 * schema de leitura. O campo existe *"para que a interface possa dizer ao Gestor, em português, que o
 * passado não muda"*.
 */
export function projetarAreaAtualizada(area: AreaAtualizada): AreaAtualizadaProjetada {
  return { ...projetarArea(area), ocorrenciasComTipoAnterior: area.ocorrenciasComTipoAnterior };
}

/** Uma linha da trilha, como o contrato a publica (item 99). */
export type MudancaDeConfiguracaoProjetada = {
  chave: ChaveDeConfiguracao;
  valorAnterior: string;
  valorNovo: string;
  autor: { pessoaId: string; nome: string };
  ocorridaEm: string;
};

/**
 * O schema `Configuracao` do contrato — o que `GET` e `PATCH /configuracao` devolvem (item 99).
 *
 * **A forma é plana**: `regras` é agrupamento da porta, e não sobe. Quem lê o JSON encontra as duas
 * chaves ao lado das mudanças, que é como a tela as usa.
 */
export type ConfiguracaoProjetada = {
  exigirSolucaoAoResolver: boolean;
  limiteDeCancelamentoDoSolicitante: "em_analise" | "em_atendimento";
  mudancas: readonly MudancaDeConfiguracaoProjetada[];
};

export function projetarConfiguracao(lida: ConfiguracaoLida): ConfiguracaoProjetada {
  return {
    exigirSolucaoAoResolver: lida.regras.exigirSolucaoAoResolver,
    limiteDeCancelamentoDoSolicitante: lida.regras.limiteDeCancelamentoDoSolicitante,
    // **Campo a campo, e nunca o objeto da porta inteiro**: a projeção escolhe o que sai.
    mudancas: lida.mudancas.map((mudanca) => ({
      chave: mudanca.chave,
      valorAnterior: mudanca.valorAnterior,
      valorNovo: mudanca.valorNovo,
      autor: { pessoaId: mudanca.autor.pessoaId, nome: mudanca.autor.nome },
      ocorridaEm: mudanca.ocorridaEm,
    })),
  };
}
