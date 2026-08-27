import type { TipoDeConteudoDeAnexo } from "@/dominio/anexo";

/**
 * **As portas do anexo** (ADR-0005, parte 1). A Aplicação declara; a Infraestrutura implementa; o anel
 * externo entrega.
 *
 * **As duas são não escopadas, e por razões diferentes.** O emissor não tem dado de organização nenhum —
 * ele assina credencial de escrita. O livro-caixa é global **de propósito**: o limite protege a conta de
 * armazenamento, que é uma só para todas as organizações (spec §3.1). Nenhuma das duas entra em
 * `RepositoriosEscopados`, e é por isso que elas chegam ao handler por `portasDeAnexo()`, sob lista
 * fechada no lint.
 */

/** Um destino de `PUT`, do jeito que o contrato o declara em `AutorizacaoDeUpload`. */
export type CredencialDeUpload = {
  /** URL assinada de escrita, no storage. Os bytes vão para cá, **fora desta API**. */
  url: string;
  metodo: "PUT";
  /**
   * Cabeçalhos exigidos pelo storage no envio — e é aqui que a etiqueta viaja.
   *
   * **`x-ms-tags: estado=pendente` é escrito pelo cliente, não pelo servidor**, porque na emissão o objeto
   * ainda não existe: quem o cria é o `PUT`. A §10.3 do contrato diz *"escrita pelo servidor na emissão"*
   * e descreve algo impossível — é o achado A-1 da spec, na fila de documentação do hub.
   */
  cabecalhos: Readonly<Record<string, string>>;
  expiraEm: string;
};

/** O que a emissão devolve. `estado: "pendente"` é constante do contrato e mora na projeção. */
export type AutorizacaoEmitida = {
  chave: string;
  chaveMiniatura: string;
  ticket: string;
  upload: CredencialDeUpload;
  uploadMiniatura: CredencialDeUpload;
};

export type PedidoDeAutorizacao = {
  organizacaoId: string;
  pessoaId: string;
  tipoConteudo: TipoDeConteudoDeAnexo;
  tamanhoBytes: number;
};

/**
 * Quem assina as duas credenciais e o ticket.
 *
 * **Uma autorização, dois destinos, um ticket, um slot.** Duas autorizações separadas dobrariam a ida e
 * volta dentro do orçamento de 60 segundos do RNF6 — é por isso que não são duas (contrato §10.2).
 */
export interface EmissorDeCredencialDeUpload {
  emitir(pedido: PedidoDeAutorizacao): Promise<AutorizacaoEmitida>;
}

/** Concedida, ou recusada com o tempo até a próxima caber — que é o `Retry-After` do `429`. */
export type ResultadoDoLimite =
  | { concedida: true }
  | { concedida: false; segundosAteLiberar: number };

/**
 * O livro-caixa de emissão.
 *
 * **Nada no caminho de reivindicação lê esta porta.** É o que separa esta tabela da *"tabela de uploads
 * pendentes"* que a §10.2 do contrato recusou, e o que preserva a suposição S-A13: o `ticket` continua
 * sendo token assinado, e a reivindicação (item 13b) confere assinatura e `HEAD`, nunca banco.
 */
export interface LivroDeAutorizacoesDeUpload {
  /**
   * Registra uma emissão para esta Pessoa **se ela ainda couber na janela**, e diz o que aconteceu.
   *
   * A contagem e a gravação são a mesma operação de propósito: separá-las abriria uma janela entre contar
   * e gravar em que a segunda réplica concederia a mesma vaga duas vezes.
   */
  registrarSeCouber(
    pessoaId: string,
    limite: number,
    janelaEmSegundos: number,
  ): Promise<ResultadoDoLimite>;
}

/** O par que `POST /anexos/autorizacoes` consome, e o único endpoint que o recebe. */
export type PortasDeAnexo = {
  emissor: EmissorDeCredencialDeUpload;
  livro: LivroDeAutorizacoesDeUpload;
};

/**
 * O que o ticket carrega. **É o mesmo objeto que `assinarTicket` serializou** no item 13a — a forma vive
 * nos dois lados de um HMAC, e por isso é declarada aqui, onde a regra a consome.
 */
export type CargaDoTicketDeAnexo = {
  chave: string;
  chaveMiniatura: string;
  organizacaoId: string;
  pessoaId: string;
  tipoConteudo: string;
  /** O que o cliente **declarou** na autorização. É o teto comparado, e é mais apertado que 512 KB. */
  tamanhoMaximo: number;
  /** ISO 8601. */
  expiraEm: string;
};

/**
 * O que o `HEAD` mais a leitura de etiquetas apuram sobre um objeto — **um fato só**.
 *
 * No Azure são duas chamadas: `Get Blob Properties` traz tamanho e tipo, e só `Get Blob Tags` traz o
 * **valor** da etiqueta. Separá-las na porta obrigaria o caso de uso a sequenciá-las; fundidas, o
 * adaptador as dispara em paralelo e a Aplicação vê um fato.
 */
export type ObjetoDescrito = {
  /** O `x-ms-blob-content-type` que o **cliente** escreveu no `PUT`. Não é leitura dos bytes. */
  tipoConteudo: string | null;
  tamanhoBytes: number;
  /** Do `Content-Disposition`, quando houver. Pelo nosso cliente é sempre `null`. */
  nomeArquivo: string | null;
  /** O valor da etiqueta `estado`, ou `null` quando o objeto **não tem** a etiqueta. */
  estado: string | null;
};

/**
 * A porta do storage no caminho da **reivindicação e da leitura** — e ela é burra de propósito.
 *
 * **Nenhum dos quatro métodos decide nada.** As seis conferências do critério 13b.2 são **regra**, e regra
 * que mora no adaptador só se testa contra o Azurite; na Aplicação ela se testa com um duplo, que é como
 * o 13a testou o limite de 30/h e como `registrarOcorrencia` já testa `ativa`.
 *
 * **Ela não é escopada, e os chamadores são.** O adaptador não conhece organização: quem amarra o escopo
 * é o `ticket` (na escrita) e a linha de `anexos` lida pelo repositório escopado (na leitura). Por isso
 * ela **não** entra em `RepositoriosEscopados`, que continua sem membro que não seja repositório
 * escopado.
 */
export interface ArmazenamentoDeAnexos {
  /** Confere a **assinatura** e devolve a carga, ou `null`. Não compara portador nem validade. */
  conferirTicket(ticket: string): CargaDoTicketDeAnexo | null;
  /** `HEAD` **e** etiquetas, em paralelo. `null` quando o objeto não existe. Não julga nada. */
  descrever(chave: string): Promise<ObjetoDescrito | null>;
  /** Troca a etiqueta para `estado=confirmado`; devolve se conseguiu. Não decide o que fazer com a falha. */
  marcarConfirmado(chave: string): Promise<boolean>;
  /** Assina uma SAS de **leitura**, de 10 minutos. Não autoriza nada — quem autoriza é a ocorrência. */
  urlDeLeitura(chave: string): string;
}
