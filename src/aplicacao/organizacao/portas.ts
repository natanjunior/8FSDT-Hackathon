import type { LimiteDeCancelamentoDoSolicitante } from "@/dominio/ocorrencia";
import type {
  AreaSemente,
  CategoriaSemente,
  Papel,
  SituacaoDoPedido,
  TipoArea,
} from "@/dominio/organizacao";
import type { FinalidadeDeContato, TipoDeContato } from "@/dominio/pessoa";

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

/**
 * O que a organização ativa devolve quando é lida por T-15 — o schema `OrganizacaoResumo` do contrato.
 *
 * **Não é `OrganizacaoCriada` menos campos.** Aquele carrega `criadoEm` e as duas contagens de semente, e
 * **semente não acontece num `PATCH`**: devolvê-las com `0` diria que nada foi semeado.
 */
export type OrganizacaoLida = {
  id: string;
  nome: string;
  codigoPublico: string;
};

/**
 * **As regras da organização que mudam o comportamento de um comando** (item 99, D29 e a D22).
 *
 * Moram aqui porque são da organização; atravessam para `aplicacao/ocorrencia` pelo envelope de `carregar`
 * e pelo modelo de leitura, e o agregado `Ocorrência` nunca as recebe (ADR-0001 intacta).
 */
export type RegrasDaOrganizacao = {
  exigirSolucaoAoResolver: boolean;
  limiteDeCancelamentoDoSolicitante: LimiteDeCancelamentoDoSolicitante;
};

/**
 * O que muda na organização ativa. **`nome` opcional, e é o que deixa o segundo campo ser aditivo**
 * (contrato §11) — com um campo só, obrigatório daria o mesmo resultado hoje e o dia da logo custaria
 * uma mudança de assinatura.
 *
 * **`codigoPublico` não está aqui, e a ausência é a decisão** (spec §3.4): gerado pelo servidor, não
 * aceito no corpo, e não rotacionável nesta entrega — código vazado produz pedido, não acesso (D25).
 */
export type CorrecaoDeOrganizacao = {
  nome?: string;
  /** Quem alterou — a coluna de auditoria de configuração, na mesma forma de `categorias` e `areas`. */
  atualizadaPorPessoaId: string;
};

/**
 * **A porta escopada da própria organização.**
 *
 * Note o que ela **não** recebe: o identificador da organização. Ele entra em `$1` pelo ponto único
 * (`infraestrutura/contexto/escopo.ts`), e sem valor a passar **não existe** chamada que edite
 * organização alheia — a mesma assimetria da ADR-0005, estrutura garante e mecanismo avisa.
 *
 * **Sem desfecho etiquetado, ao contrário das irmãs de `categorias` e `areas`.** Aquelas têm
 * `nao-encontrada` porque recebem um `{id}` que pode apontar para outra organização, e `nome-duplicado`
 * porque têm `UNIQUE (organizacao_id, nome)`. Aqui não há `{id}` e `organizacoes` não tem unicidade sobre
 * `nome` (modelo §6.3): duas organizações podem se chamar *Residencial Aurora*, e é o código que as
 * distingue. Zero linhas seria o banco em outro estado, não um desfecho de domínio.
 */
export interface RepositorioEscopadoDaOrganizacao {
  corrigir(correcao: CorrecaoDeOrganizacao): Promise<OrganizacaoLida>;
}

/** As duas chaves que a trilha de configuração conhece — os nomes das colunas, como o banco os grava. */
export type ChaveDeConfiguracao = "exigir_solucao_ao_resolver" | "limite_cancelamento_solicitante";

/** Uma linha da trilha de configuração (item 99, D30). */
export type MudancaDeConfiguracaoLida = {
  chave: ChaveDeConfiguracao;
  /** Como o banco guarda: `"true"`/`"false"`, ou o nome do estado. A tela traduz. */
  valorAnterior: string;
  valorNovo: string;
  autor: PessoaReferenciaDaConfiguracao;
  ocorridaEm: string;
};

/** Quem mudou a regra, como toda leitura de gente devolve: sem contato, sem papel. */
export type PessoaReferenciaDaConfiguracao = { pessoaId: string; nome: string };

/** O que `GET /configuracao` devolve: as regras de agora e a história delas. */
export type ConfiguracaoLida = {
  regras: RegrasDaOrganizacao;
  /** Da mais recente para a mais antiga. Lista vazia, nunca `null`. */
  mudancas: readonly MudancaDeConfiguracaoLida[];
};

/** O que a porta de escrita recebe. **Campo ausente é *não mexa*.** */
export type AlteracaoDeConfiguracao = Partial<RegrasDaOrganizacao> & {
  /** Quem mudou. Vai para `atualizado_por_pessoa_id`, de onde o gatilho da migração 017 tira o autor. */
  atualizadaPorPessoaId: string;
};

/**
 * **A porta escopada da configuração** (item 99).
 *
 * Como a irmã de `organizacoes`, ela **não recebe** o identificador da organização: ele entra em `$1`
 * pelo ponto único. **Ela também não escreve a trilha** — quem grava cada linha é o gatilho da migração
 * 017, dentro da mesma instrução de `update`, com o valor anterior da linha travada.
 */
export interface RepositorioEscopadoDaConfiguracao {
  ler(): Promise<ConfiguracaoLida>;
  alterar(alteracao: AlteracaoDeConfiguracao): Promise<ConfiguracaoLida>;
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
 * **A posição de um item criado — item 50, spec §4.3.** A intenção `"no-fim"`, que o repositório resolve
 * na própria instrução do `insert` — a maior `ordem` da organização mais um, contando as inativas, e 1 na
 * lista vazia —, ou um número, que **nenhum caminho de hoje usa**: `ordem` saiu do corpo de `POST` com o
 * item 44k.
 *
 * **A intenção, e não um número**, porque ler o máximo aqui seria uma segunda instrução e uma corrida a
 * mais. Quem decide que o padrão é *no fim* é a Aplicação; quem calcula é o banco. **O número continua no
 * tipo** porque colapsá-lo trocaria a assinatura de duas portas e do `insert` das duas tabelas por nenhum
 * ganho: o `"no-fim"` é a intenção que a Aplicação manda, e é ela que o tipo precisa carregar.
 */
export type OrdemNaCriacao = number | "no-fim";

/**
 * O que `POST /categorias` grava. **`icone` chega resolvido, e `ordem` chega como a intenção `"no-fim"`**
 * (`OrdemNaCriacao`). O padrão é decisão de produto e mora na Aplicação, não no schema de entrada.
 */
export type NovaCategoria = {
  nome: string;
  icone: string;
  ordem: OrdemNaCriacao;
  /** Vai para `criado_por_pessoa_id`. **Exige vínculo vivo** — a FK é composta para `vinculos`. */
  criadaPorPessoaId: string;
};

/**
 * O que `PATCH /categorias/{id}` altera. **Campo ausente é *não mexa*** — não é *apague*.
 *
 * **Sem `ordem`:** quem muda posição é `PUT /categorias/ordem`, que grava a lista inteira numa transação
 * (item 50). Um `PATCH` com ordem própria criaria empate e lacuna na lista que o `PUT` acabou de deixar
 * de 1 a n.
 */
export type CorrecaoDeCategoria = {
  categoriaId: string;
  nome?: string;
  icone?: string;
  ativa?: boolean;
  /** Vai para `atualizado_por_pessoa_id`. É *"último a escrever"*, não histórico (modelo §6.5). */
  atualizadaPorPessoaId: string;
};

export type NovaArea = {
  nome: string;
  tipo: TipoArea;
  ordem: OrdemNaCriacao;
  criadaPorPessoaId: string;
};

/** O mesmo de `CorrecaoDeCategoria`, e **sem `ordem`** pela mesma razão: quem a grava é o `PUT`. */
export type CorrecaoDeArea = {
  areaId: string;
  nome?: string;
  tipo?: TipoArea;
  ativa?: boolean;
  atualizadaPorPessoaId: string;
};

/**
 * A Área depois do `PATCH`, mais a contagem que **só a correção** devolve.
 *
 * `ocorrenciasComTipoAnterior` existe *"para que a interface possa dizer ao Gestor, em português, que o
 * passado não muda"* (contrato §8.1). **É um campo de resposta que só existe para produzir uma frase de
 * tela.**
 */
export type AreaAtualizada = AreaLida & { ocorrenciasComTipoAnterior: number };

/**
 * Os quatro desfechos. **Etiqueta, não exceção** — a mesma doutrina dos itens 7a, 8 e 9a: nome duplicado
 * é tradução de índice único, e o vocabulário de recusa do contrato pertence à Aplicação.
 */
export type ResultadoDeCriacaoDeCategoria =
  | { desfecho: "criada"; categoria: CategoriaLida }
  | { desfecho: "nome-duplicado" };

export type ResultadoDeCorrecaoDeCategoria =
  | { desfecho: "corrigida"; categoria: CategoriaLida }
  | { desfecho: "nome-duplicado" }
  | { desfecho: "nao-encontrada" };

export type ResultadoDeCriacaoDeArea =
  | { desfecho: "criada"; area: AreaLida }
  | { desfecho: "nome-duplicado" };

export type ResultadoDeCorrecaoDeArea =
  | { desfecho: "corrigida"; area: AreaAtualizada }
  | { desfecho: "nome-duplicado" }
  | { desfecho: "nao-encontrada" };

/** Uma linha da reordenação: o item e a posição nova, de 1 a n. */
export type PosicaoNaLista = {
  id: string;
  ordem: number;
};

/**
 * O que `PUT /categorias/ordem` e `PUT /areas/ordem` gravam — item 50.
 *
 * **`posicoes` é a lista inteira, e já passou pela regra do conjunto na Aplicação.** A porta a confere de
 * novo contra as linhas que travou, dentro da transação: é o predicado da escrita (spec §4.7).
 */
export type Reordenacao = {
  posicoes: readonly PosicaoNaLista[];
  /** Vai para `atualizado_por_pessoa_id`, **só nas linhas cuja `ordem` mudou** (spec §4.2). */
  atualizadaPorPessoaId: string;
};

/**
 * Os dois desfechos. **`lista-desatualizada` é o predicado falhando dentro da transação:** o conjunto
 * travado não é o conjunto pedido, porque alguém criou um item depois da leitura. `itens` é a lista
 * inteira, ativas e inativas, na ordem nova.
 */
export type ResultadoDaReordenacao<L> =
  | { desfecho: "reordenada"; itens: readonly L[] }
  | { desfecho: "lista-desatualizada" };

/**
 * As duas portas escopadas desta fatia. Nenhuma recebe o identificador da organização — ele está amarrado
 * ao `$1` pelo ponto único (ADR-0003), e o repositório **não tem como saber** qual é. É isso que torna
 * *"categoria de outra organização"* **inalcançável**, e é daí que sai o `404` idêntico ao de inexistente
 * que a §6.3 do contrato exige.
 */
export interface RepositorioEscopadoDeCategorias {
  listar(opcoes: { apenasAtivas: boolean }): Promise<readonly CategoriaLida[]>;
  criar(nova: NovaCategoria): Promise<ResultadoDeCriacaoDeCategoria>;
  corrigir(correcao: CorrecaoDeCategoria): Promise<ResultadoDeCorrecaoDeCategoria>;
  /** Numa transação escopada: trava a lista, confere o conjunto, grava só o que mudou e relê. */
  reordenar(reordenacao: Reordenacao): Promise<ResultadoDaReordenacao<CategoriaLida>>;
}

export interface RepositorioEscopadoDeAreas {
  listar(opcoes: { apenasAtivas: boolean }): Promise<readonly AreaLida[]>;
  criar(nova: NovaArea): Promise<ResultadoDeCriacaoDeArea>;
  corrigir(correcao: CorrecaoDeArea): Promise<ResultadoDeCorrecaoDeArea>;
  /** Numa transação escopada: trava a lista, confere o conjunto, grava só o que mudou e relê. */
  reordenar(reordenacao: Reordenacao): Promise<ResultadoDaReordenacao<AreaLida>>;
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
  situacao: SituacaoDoPedido;
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
 * cinco exceções da §4.4, porque `GET /contexto` precisa dos pedidos da Pessoa em toda parte.
 *
 * **Parte de `pedidos_de_entrada`, filtrando por `pessoa_id`** — nunca de `pessoas` (DoD · contrato §4.6).
 */
export interface RepositorioGlobalDePedidosDeEntrada {
  /** Todos os pedidos da Pessoa, em `criadoEm` decrescente, nas três situações (spec §2.6). */
  daPessoa(pessoaId: string): Promise<PedidoDaPessoa[]>;
}

/** O que a página do convite pode saber de uma organização: o nome e o código, e mais nada. */
export type OrganizacaoDoConvite = { nome: string; codigoPublico: string };

/**
 * **A porta da primeira operação sem sessão** (item 86, ADR-0018): `GET /convites/{codigo}`.
 *
 * **O tipo de retorno de `porCodigo` é a prova do critério 86.2.** Não há `id`, contagem, tipo nem pessoa
 * no que ela devolve, e quem implementa seleciona só as duas colunas. Um campo a mais aqui é um campo a
 * mais para qualquer pessoa sem conta.
 *
 * **`temPedidoPendente` só é chamada com sessão**, e a pessoa vem dela: é a pergunta *"eu já pedi para
 * entrar nesta?"*, que o `GET /contexto` não responde porque os pedidos dele trazem só o nome da
 * organização, e nome não é único.
 */
export interface RepositorioDeConvites {
  porCodigo(codigoPublico: string): Promise<OrganizacaoDoConvite | null>;
  temPedidoPendente(pessoaId: string, codigoPublico: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// A decisão do pedido — item 8 (D25)
// ---------------------------------------------------------------------------

/** O schema `Contato` do contrato, do lado de dentro. Sai **ordenado por `ordem`** (modelo §6.17). */
export type ContatoLido = {
  id: string;
  tipo: TipoDeContato;
  valor: string;
  finalidade: FinalidadeDeContato;
  temWhatsapp: boolean;
  ordem: number;
  observacao: string | null;
};

/**
 * Um contato **entrando** — o `ContatoParaEscrita` do contrato, do lado de dentro.
 *
 * **Sem `id`**, porque a escrita é substituição: o corpo traz a lista completa e o servidor troca a
 * anterior inteira.
 *
 * **E sem `ordem`, que é a decisão 2.1 da spec:** quem a grava é o servidor, pela posição na lista. O
 * schema de entrada aceita `ordem` e **recusa** a que não bate com a posição, então nada chega aqui com
 * ordem própria a respeitar — e `UNIQUE (pessoa_id, ordem)` deixa de ser alcançável por entrada.
 *
 * **Os opcionais do contrato já vêm resolvidos:** o schema aplica `finalidade: "pessoal"`,
 * `temWhatsapp: false` e `observacao: null`. A porta recebe dado resolvido, nunca ausência.
 */
export type ContatoParaEscrita = {
  tipo: TipoDeContato;
  valor: string;
  finalidade: FinalidadeDeContato;
  temWhatsapp: boolean;
  observacao: string | null;
};

/**
 * **Como o Gestor vê um pedido** — o schema `PedidoDeEntradaDetalhe` do contrato.
 *
 * `pessoa` traz `telefoneInformado` e **não traz `contatos[]`**, e a diferença é de privacidade, não de
 * conveniência: `contatos` é tabela **global**, e devolvê-la aqui mostraria ao Gestor desta organização os
 * contatos que a pessoa cadastrou em **outra** (schema `PessoaDoPedido`).
 *
 * **`observacao` não está aqui, e é o achado A-8-2:** o contrato guarda o motivo da recusa e nenhum schema
 * de leitura o devolve. O repositório não a expõe — pôr aqui o que o contrato não declara seria decidir
 * sozinho uma questão que é do hub.
 */
export type PedidoDeEntradaLido = {
  id: string;
  pessoa: {
    pessoaId: string;
    nome: string;
    /** Em E.164, ou `null`. O telefone **deste pedido**, não o cadastro dela. */
    telefoneInformado: string | null;
  };
  situacao: SituacaoDoPedido;
  criadoEm: string;
  decididoEm: string | null;
  decididoPor: { pessoaId: string; nome: string } | null;
};

/**
 * O schema `Vinculo` do contrato — **um objeto de leitura declarado, nunca a linha de `vinculos`**
 * (ADR-0005, parte 3). `organizacao_id` e `revogado_em` existem no esquema e não aparecem aqui. O
 * relógio de atualização aparece, e por decisão: `atualizadoEm` é a resposta de uma coluna de tela.
 *
 * **Serve três consumidores**: o `200` de `POST …/aprovar` (item 8), o `201` de `POST /vinculos` e cada
 * item de `GET /vinculos` (item 9a). Um tipo só, porque o schema do contrato é um só.
 */
export type VinculoLido = {
  pessoa: { pessoaId: string; nome: string; contatos: readonly ContatoLido[] };
  papel: Papel;
  /** A **unidade** da pessoa nesta organização. `null` para o Gestor e o Encarregado terceirizado. */
  area: { id: string; nome: string; tipo: TipoArea } | null;
  temConta: boolean;
  criadoEm: string;
  /**
   * Quando este participante mudou pela última vez: a **maior** entre o relógio da Pessoa e o do
   * Vínculo, os dois carimbados por gatilho (migração `012`). `null` é *nenhuma alteração registrada*,
   * e a tela mostra um traço — nunca a data de entrada.
   */
  atualizadoEm: string | null;
};

/** O que `POST /vinculos` recebe, já conferido pelo schema. */
export type DadosDoCadastro = {
  nome: string;
  papel: Papel;
  /** `null` é *sem unidade* — o caso do Gestor e do Encarregado terceirizado. */
  areaId: string | null;
  /**
   * **Sempre uma lista, nunca ausente.** No cadastro a Pessoa é nova: *"omitir"* e *"lista vazia"*
   * descrevem o mesmo estado, e o schema resolve a ausência em `[]`. A distinção que importa é a do
   * `PATCH`, e mora em `DadosDaCorrecao`.
   */
  contatos: readonly ContatoParaEscrita[];
};

/**
 * O que `PATCH /vinculos/{pessoaId}` recebe.
 *
 * **`undefined` e `null` significam coisas diferentes em `areaId`**, e é o contrato que exige a
 * distinção: ausente é *"não mexa"*; `null` é *"tire a unidade"*.
 */
export type DadosDaCorrecao = {
  pessoaId: string;
  nome?: string;
  areaId?: string | null;
  /**
   * **Ausente e `[]` são instruções diferentes** (contrato §8.2): ausente é *não mexa em nada*, `[]` é
   * *remova todos*. É a armadilha de vazio-versus-ausente, e aqui ela **apaga dados** — um `?? []` em
   * qualquer ponto deste caminho destrói o contato de quem só corrigiu a unidade.
   */
  contatos?: readonly ContatoParaEscrita[];
};

/**
 * Os desfechos das duas escritas. **Etiqueta, não exceção** — a mesma doutrina do item 8: o vocabulário de
 * recusa do contrato pertence à Aplicação, e a Infraestrutura só relata o que o banco decidiu.
 */
export type ResultadoDoCadastro =
  | { desfecho: "cadastrado"; vinculo: VinculoLido }
  | { desfecho: "area-invalida" }
  | { desfecho: "contato-duplicado" };

export type ResultadoDaCorrecao =
  | { desfecho: "corrigido"; vinculo: VinculoLido }
  | { desfecho: "nao-encontrado" }
  | { desfecho: "pessoa-com-conta" }
  | { desfecho: "area-invalida" }
  | { desfecho: "contato-duplicado" };

/**
 * Por que um vínculo **não pode** sair.
 *
 * **Um valor só para o histórico, e nomear qual dos nove dependentes bloqueou foi recusado** com
 * argumento (`respostas.md` P2): nomear transforma uma constante de tela em nove, obriga a décima quando
 * alguém acrescentar tabela, e põe nome de tabela do esquema num modelo de leitura. O que o Gestor precisa
 * saber é que o vínculo não pode ser apagado, e a tela oferece encerrar o acesso no lugar (item 84).
 */
export type ImpedimentoDeRemocao = "historico" | "ultimo-gestor";

/**
 * Os quatro desfechos da remoção. **Etiqueta, não exceção** — a mesma doutrina dos itens 7a, 8 e 9a.
 *
 * `com-historico` é a tradução do `23503`, e chega de **duas** origens: as nove chaves `on delete
 * restrict`, que erram no `delete`, e `organizacoes_criada_por_vinculo_fk`, que é
 * `deferrable initially deferred` e erra no `COMMIT`.
 */
export type ResultadoDaRemocao =
  | { desfecho: "removido" }
  | { desfecho: "nao-encontrado" }
  | { desfecho: "ultimo-gestor" }
  | { desfecho: "com-historico" };

/**
 * Os três desfechos da revogação — item 84. **Etiqueta, não exceção**, a mesma doutrina da remoção.
 *
 * **Não há `com-historico` aqui, e a ausência é o item inteiro:** revogar é `update`, a linha de
 * `vinculos` fica, e nenhuma chave estrangeira tem o que recusar. É por isso que revogar alcança quem o
 * `DELETE` não alcança.
 *
 * `nao-encontrado` cobre três casos com uma resposta: nunca houve vínculo, é de outra organização, ou
 * **já foi revogado** — a guarda `revogado_em is null` mora no `where`.
 */
export type ResultadoDaRevogacao =
  | { desfecho: "revogado" }
  | { desfecho: "nao-encontrado" }
  | { desfecho: "ultimo-gestor" };

/**
 * **A porta escopada dos vínculos.**
 *
 * Mudou de módulo em 23/08/2026, e a razão é dependência: os casos de uso que a consomem são capacidades
 * de **organização**, e deixá-la em `aplicacao/contexto/` produziria `organizacao → contexto →
 * organizacao` — um ciclo entre módulos irmãos que hoje não existe.
 *
 * **A consulta parte de `vinculos` e faz `JOIN` para `pessoas`** — nunca o contrário (contrato §4.6,
 * modelo §4.3). É por isso que não existe, e não deve existir, uma porta de `Pessoa` escopada: `pessoas` é
 * global e não tem coluna de organização para filtrar.
 */
export interface RepositorioEscopadoDeVinculos {
  /** Os vínculos ativos **desta** organização, ordenados por nome. É a lista de T-08 e a de candidatos a responsável (D21). */
  ativos(): Promise<readonly VinculoLido[]>;

  /** Um vínculo desta organização, ou `null` — que é o `404` da §6.3, idêntico ao de inexistente. */
  porPessoa(pessoaId: string): Promise<VinculoLido | null>;

  /** Cria **Pessoa e Vínculo na mesma transação** (contrato §4.6). Nunca procura por Pessoa existente. */
  cadastrar(dados: DadosDoCadastro): Promise<ResultadoDoCadastro>;

  /** Corrige nome e unidade. **A guarda de quem tem conta nomeia campos, não o endpoint** (contrato §8.2). */
  corrigir(dados: DadosDaCorrecao): Promise<ResultadoDaCorrecao>;

  /**
   * Remove o vínculo — **o único `DELETE` do contrato** (§8.2, P6).
   *
   * **A guarda do último Gestor mora no `where` do próprio `delete`, e a do histórico é do banco.** A
   * primeira é a única regra deste endpoint que nenhuma constraint alcança; a segunda são as nove chaves
   * estrangeiras `on delete restrict`, e o repositório **traduz** a recusa em vez de antecipá-la — uma
   * leitura prévia perderia a corrida que o `409` existe para cobrir.
   */
  remover(pessoaId: string): Promise<ResultadoDaRemocao>;

  /**
   * Encerra o acesso **preservando o registro** — item 84. Marca `revogado_em`; a linha fica, e todo
   * `join vinculos` da trilha, da linha do tempo e do detalhe continua nomeando a pessoa.
   *
   * **A trava e a guarda são as mesmas do `remover`**, e a trava comum importa além de cada operação: um
   * Gestor removendo o outro enquanto o outro revoga o primeiro travam as mesmas linhas e se serializam.
   */
  revogar(pessoaId: string): Promise<ResultadoDaRevogacao>;

  /**
   * Por vínculo ativo desta organização, o que impede a remoção. **Ausência do `pessoaId` no mapa
   * significa *pode sair*** — não há valor nulo aqui.
   *
   * **Existe só para a tela** (spec §3.4): o critério 10.4 exige que o botão não apareça quando o vínculo
   * não pode sair, e o payload de `GET /vinculos` não tem esse dado **e não vai passar a ter** —
   * acrescentar campo ali mudaria a especificação versionada. T-08 é Server Component e lê pela estrada
   * direta do contrato §5.
   *
   * **Quando os dois impedimentos valem, devolve `ultimo-gestor`** — a mesma precedência do endpoint,
   * para que a razão na tela e a razão do `409` nunca discordem.
   */
  impedimentosDeRemocao(): Promise<ReadonlyMap<string, ImpedimentoDeRemocao>>;

  /**
   * Por vínculo ativo, quantas atribuições **vigentes** ele tem em ocorrência **não terminal** — item 84.
   * **Ausência do `pessoaId` é zero.**
   *
   * **Existe só para a tela**, como `impedimentosDeRemocao`: a confirmação de encerrar o acesso diz quantas
   * ocorrências ficam atribuídas a quem sai, porque elas não entram na fila *sem responsável* — têm
   * atribuição vigente — e o Gestor não as acharia de outro jeito (`respostas.md` P2 do item 84).
   */
  responsabilidadesEmAberto(): Promise<ReadonlyMap<string, number>>;
}

/**
 * Os desfechos da aprovação. **Etiqueta, não exceção**, pela mesma razão do 7a: são desfechos de uma
 * escrita transacional, três deles são **traduções de garantias do banco**, e o vocabulário de recusa do
 * contrato pertence à Aplicação, não à Infraestrutura.
 */
export type ResultadoDaAprovacao =
  | { desfecho: "aprovado"; vinculo: VinculoLido }
  | { desfecho: "nao-encontrado" }
  | { desfecho: "ja-decidido" }
  | { desfecho: "ja-vinculado" }
  | { desfecho: "area-invalida" };

export type ResultadoDaRecusa =
  | { desfecho: "recusado"; pedido: PedidoDeEntradaLido }
  | { desfecho: "nao-encontrado" }
  | { desfecho: "ja-decidido" };

/**
 * **A porta escopada dos pedidos** — leitura e as duas decisões.
 *
 * Não recebe o identificador da organização: ele está amarrado ao `$1` pelo ponto único (ADR-0003). Um
 * pedido de outra organização é **inalcançável**, e é isso que produz o `404` idêntico ao de inexistente
 * que a §6.3 do contrato exige.
 *
 * **A atomicidade da aprovação é promessa desta porta, não parâmetro dela:** quem chama não abre
 * transação e não sabe que há uma.
 */
export interface RepositorioEscopadoDePedidosDeEntrada {
  /** Os pedidos desta organização nas situações pedidas, em `criadoEm` **crescente** — é fila de espera. */
  listar(opcoes: { situacoes: readonly SituacaoDoPedido[] }): Promise<readonly PedidoDeEntradaLido[]>;

  /** Decide o pedido e cria o Vínculo, **na mesma transação**. */
  aprovar(decisao: {
    pedidoId: string;
    papel: Papel;
    /** A unidade, quando informada. `null` é *sem unidade*, e é o caso do Gestor. */
    areaId: string | null;
    decididoPorPessoaId: string;
  }): Promise<ResultadoDaAprovacao>;

  /** Decide o pedido e **não cria nada**. */
  recusar(decisao: {
    pedidoId: string;
    /** Já aparada; `null` quando vazia. O `CHECK` do banco só a aceita em pedido recusado (§6.15). */
    observacao: string | null;
    decididoPorPessoaId: string;
  }): Promise<ResultadoDaRecusa>;
}
