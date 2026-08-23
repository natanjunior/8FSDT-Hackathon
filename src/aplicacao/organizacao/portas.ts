import type { AreaSemente, CategoriaSemente, TipoArea } from "@/dominio/organizacao";

/**
 * **As portas da Organização** (ADR-0005, parte 1): a Aplicação declara, a Infraestrutura implementa.
 *
 * Nada aqui é o formato de uma tabela. `OrganizacaoCriada` é o schema `Organizacao` do contrato menos o
 * que a Interface acrescenta; `CategoriaLida` e `AreaLida` são os schemas `Categoria` e `Area` — e
 * nenhum dos dois carrega `organizacao_id`, `criado_por_pessoa_id` ou os relógios de auditoria, que
 * existem no banco e **não sobem**.
 */

/**
 * O que a POL-01 cria, junto, numa transação só.
 *
 * **`codigoPublico` chega pronto**, sorteado pela Aplicação: o repositório não escolhe código, e por isso
 * não tem como escolher um derivado do nome (contrato §8.1). **As duas listas chegam prontas** pela mesma
 * razão — a semente é decisão de domínio, e a Infraestrutura só a insere.
 */
export type NovaOrganizacao = {
  nome: string;
  codigoPublico: string;
  criadaPorPessoaId: string;
  categorias: readonly CategoriaSemente[];
  areas: readonly AreaSemente[];
};

/**
 * O schema `Organizacao` do `openapi.yaml`, do lado de dentro.
 *
 * **As duas contagens são o que foi realmente inserido**, não o tamanho das listas enviadas: é isso que
 * as torna capazes de detectar semente parcial sem uma segunda chamada (modelo §14.3).
 */
export type OrganizacaoCriada = {
  id: string;
  nome: string;
  codigoPublico: string;
  criadoEm: string;
  categoriasSemeadas: number;
  areasSemeadas: number;
};

export interface RepositorioDeOrganizacoes {
  /**
   * Cria organização, vínculo de Gestor e as duas sementes **na mesma transação** — não existe organização
   * com zero categorias (modelo §14.3).
   *
   * A atomicidade é **promessa desta porta**, não parâmetro dela: quem chama não abre transação, não a
   * fecha, e não tem como esquecer.
   *
   * @throws CodigoPublicoEmUso quando o `codigoPublico` já pertence a outra organização.
   */
  criar(nova: NovaOrganizacao): Promise<OrganizacaoCriada>;
}

/** O schema `Categoria` do contrato. `icone` **nunca vem nulo** — a coluna é `NOT NULL`. */
export type CategoriaLida = {
  id: string;
  nome: string;
  icone: string;
  ativa: boolean;
  ordem: number;
};

/** O schema `Area` do contrato. `tipo` é o **vigente**; o congelado mora na ocorrência. */
export type AreaLida = {
  id: string;
  nome: string;
  tipo: TipoArea;
  ativa: boolean;
  ordem: number;
};

/**
 * As duas portas escopadas desta fatia. Nenhuma das duas recebe o identificador da organização — ele está
 * amarrado ao `$1` pelo ponto único (ADR-0003), e o repositório **não tem como saber** qual é.
 */
export interface RepositorioEscopadoDeCategorias {
  listar(opcoes: { apenasAtivas: boolean }): Promise<readonly CategoriaLida[]>;
}

export interface RepositorioEscopadoDeAreas {
  listar(opcoes: { apenasAtivas: boolean }): Promise<readonly AreaLida[]>;
}

// ---------------------------------------------------------------------------
// Pedido de entrada (D25)
// ---------------------------------------------------------------------------

/** O que `POST /pedidos-de-entrada` devolve — o schema `PedidoDeEntrada` do contrato, e nada mais. */
export type PedidoDeEntradaRegistrado = {
  id: string;
  /** **Só o nome.** O código é público, mas isso não autoriza ler quem está lá dentro (contrato §8.2). */
  organizacao: { nome: string };
  situacao: "pendente";
  /** ISO 8601. A conversão do `timestamptz` acontece no repositório: nenhuma `Date` do driver sobe. */
  criadoEm: string;
};

/** Um pedido da própria Pessoa, como `GET /contexto` o devolve. */
export type PedidoDaPessoa = {
  id: string;
  organizacao: { nome: string };
  situacao: "pendente" | "aprovado" | "recusado";
  criadoEm: string;
};

/**
 * O desfecho da tentativa de registrar. **Etiqueta, não exceção** — a razão está no plano da tarefa 3: as
 * três recusas são desfechos de uma escrita transacional, uma delas é tradução de índice único, e o
 * vocabulário de recusa do contrato pertence a esta camada, não à Infraestrutura.
 */
export type ResultadoDoPedidoDeEntrada =
  | { desfecho: "registrado"; pedido: PedidoDeEntradaRegistrado }
  | { desfecho: "codigo-nao-encontrado" }
  | { desfecho: "ja-vinculado" }
  | { desfecho: "ja-pendente" };

/**
 * A porta de escrita. **A atomicidade é promessa da porta, não parâmetro dela** — quem chama não passa
 * transação, e não sabe que há uma. As três escritas (pedido, nome, contato) acontecem juntas ou nenhuma.
 *
 * **Roda fora do funil de escopo** (ADR-0003, emenda de 20/08/2026): o `organizacao_id` vem do **Código da
 * Organização apresentado na requisição**, resolvido para uma Organização. É uma das exatamente duas
 * operações com essa licença, e a lista é fechada.
 */
export interface RepositorioDePedidosDeEntrada {
  registrar(dados: {
    pessoaId: string;
    codigoPublico: string;
    /** `null` quando não há correção a fazer — a Aplicação já comparou com o nome atual. */
    nome: string | null;
    /** Já em E.164, conferido pelo schema de entrada. `null` quando não foi informado. */
    telefone: string | null;
  }): Promise<ResultadoDoPedidoDeEntrada>;
}

/**
 * A porta de leitura que **atravessa organizações**, no molde de `RepositorioGlobalDeVinculos`: uma das
 * quatro exceções da §4.4, porque `GET /contexto` precisa dos pedidos da Pessoa em toda parte.
 *
 * **Parte de `pedidos_de_entrada`, filtrando por `pessoa_id`** — nunca de `pessoas` (DoD · contrato §4.6).
 */
export interface RepositorioGlobalDePedidosDeEntrada {
  /** Todos os pedidos da Pessoa, em `criadoEm` decrescente, nas três situações (spec §2.6). */
  daPessoa(pessoaId: string): Promise<PedidoDaPessoa[]>;
}
