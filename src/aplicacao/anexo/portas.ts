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
