import type {
  RepositorioDeOrganizacoes,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
} from "@/aplicacao/organizacao";
import type { Vinculo } from "@/dominio/organizacao";

/**
 * **As portas que esta camada consome** (ADR-0005, parte 1).
 *
 * A Aplicação declara a interface; a Infraestrutura a implementa; o anel externo entrega. A Aplicação
 * **não importa `infraestrutura/`** — não tem o que importar, e é isso que torna a inversão estrutural em
 * vez de combinada (ADR-0006, regra 2).
 *
 * **O que atravessa estas portas é agregado ou objeto de leitura declarado — nunca linha de banco**
 * (ADR-0005, parte 3). Nenhum tipo aqui é o formato de uma tabela: `VinculoNaOrganizacao` carrega o
 * agregado `Vinculo` e um resumo declarado da Organização.
 */

// ---------------------------------------------------------------------------
// O que o provedor de autenticação entrega, depois do ACL
// ---------------------------------------------------------------------------

/**
 * A sessão, já traduzida. **O domínio nunca vê token** (arquitetura.md, Parte I §3): o que atravessa é
 * isto, e mais nada. `nomeSugerido` vem dos metadados da conta, preenchidos no cadastro (contrato §4.1).
 */
export type SessaoDoProvedor = {
  usuarioId: string;
  nomeSugerido: string | null;
};

export interface PortaDeAutenticacao {
  /** A sessão da requisição, ou `null` se não houver — não lança. */
  sessaoAtual(): Promise<SessaoDoProvedor | null>;
}

// ---------------------------------------------------------------------------
// Pessoa — global (modelo-de-dados.md §4.1)
// ---------------------------------------------------------------------------

/** O `PessoaReferencia` do contrato: identificador e nome, e **nunca** contato (contrato §4.6). */
export type PessoaReferencia = {
  pessoaId: string;
  nome: string;
};

export interface RepositorioDePessoas {
  /**
   * Resolve a sessão em Pessoa. É a consulta mais frequente do sistema inteiro (modelo §6.2), servida
   * pelo `UNIQUE (usuario_id)`.
   */
  porUsuario(usuarioId: string): Promise<PessoaReferencia | null>;

  /**
   * Cria a Pessoa deste Usuário se ela ainda não existir, e devolve a Pessoa em qualquer caso.
   *
   * **Idempotente por natureza**, porque `UNIQUE (usuario_id)` recusa a segunda tentativa (modelo §9.2).
   * É a resposta adotada para o órfão do lado do Auth, e é o motivo de o gatilho
   * `AFTER INSERT ON auth.users` ter sido rejeitado: a regra vive no código, o banco guarda o dado.
   */
  garantirParaUsuario(usuarioId: string, nome: string): Promise<PessoaReferencia>;
}

// ---------------------------------------------------------------------------
// Vínculo — escopado, mas com uma leitura que atravessa organizações
// ---------------------------------------------------------------------------

/** Objeto de leitura declarado: o agregado `Vinculo` mais o resumo da Organização a que ele pertence. */
export type VinculoNaOrganizacao = {
  vinculo: Vinculo;
  organizacao: {
    id: string;
    nome: string;
    codigoPublico: string;
  };
};

/**
 * **A porta que roda fora do escopo de organização.** É uma das quatro exceções enumeradas
 * (contrato §4.4 · ADR-0003): `GET /contexto` precisa listar os vínculos de **todas** as organizações da
 * Pessoa, então não há escopo a aplicar.
 *
 * A consulta **parte de `vinculos`, nunca de `pessoas`** — `pessoas` é global e não tem coluna de
 * organização, então não há filtro que o repositório possa aplicar nela (DoD · contrato §4.6). A regra de
 * lint não alcança este caso, porque a consulta é legítima: ela só partiria da tabela errada. A defesa é
 * teste, e ele existe em `testes/aplicacao/resolucao-de-contexto.test.ts`.
 */
export interface RepositorioGlobalDeVinculos {
  ativosDaPessoa(pessoaId: string): Promise<VinculoNaOrganizacao[]>;
}

/**
 * **A porta escopada.** Toda leitura passa por aqui já filtrada pela organização ativa — o filtro é
 * aplicado numa função só, que é o compromisso da ADR-0003. Quem monta é o anel externo (ADR-0005).
 */
export interface RepositorioEscopadoDeVinculos {
  /** Os vínculos ativos **desta** organização. Nunca vê linha de outra. */
  ativos(): Promise<Array<{ vinculo: Vinculo; pessoa: PessoaReferencia }>>;
}

// ---------------------------------------------------------------------------
// Os dois conjuntos de portas
// ---------------------------------------------------------------------------

/**
 * **De onde vem a organização que a sessão já escolheu.**
 *
 * É porta e não parâmetro simples porque a escolha é **amarrada ao usuário**: o cookie de uma sessão não
 * vale em outra (contrato §4.2 — a organização nunca é entrada livre do cliente). Quem implementa é a
 * camada de Interface, que é a única que pode ler cookie e conferir assinatura; a Aplicação só pergunta.
 */
export interface EscolhaDaSessao {
  organizacaoEscolhida(usuarioId: string): string | null;
}

/** O que as quatro operações da §4.4 recebem. O nome grita que **não** é escopado. */
export type PortasGlobais = {
  autenticacao: PortaDeAutenticacao;
  pessoas: RepositorioDePessoas;
  vinculos: RepositorioGlobalDeVinculos;
  /**
   * A escrita que **cria** o escopo (contrato §4.4). Está aqui, e não nas escopadas, porque no instante em
   * que ela roda ainda não há organização a que escopar — é o bootstrap da D26.
   */
  organizacoes: RepositorioDeOrganizacoes;
};

/** O que os outros 33 endpoints recebem. Tudo aqui já vem filtrado pela organização ativa. */
export type RepositoriosEscopados = {
  vinculos: RepositorioEscopadoDeVinculos;
  categorias: RepositorioEscopadoDeCategorias;
  areas: RepositorioEscopadoDeAreas;
};
