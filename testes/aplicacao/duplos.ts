import type {
  EmissorDeCredencialDeUpload,
  LivroDeAutorizacoesDeUpload,
} from "@/aplicacao/anexo";
import type {
  EscolhaDaSessao,
  PessoaReferencia,
  PortaDeAutenticacao,
  PortasGlobais,
  RepositorioDePessoas,
  RepositorioGlobalDeVinculos,
  SessaoDoProvedor,
  VinculoNaOrganizacao,
} from "@/aplicacao/contexto";
import {
  CodigoPublicoEmUso,
  type NovaOrganizacao,
  type PedidoDaPessoa,
  type RepositorioDeOrganizacoes,
  type RepositorioDePedidosDeEntrada,
  type RepositorioGlobalDePedidosDeEntrada,
} from "@/aplicacao/organizacao";
import { Vinculo, type Papel } from "@/dominio/organizacao";

/**
 * ============================================================================
 *  Os duplos em memória
 * ============================================================================
 *
 * **Isto é o que a ADR-0005 comprou.** A `arquitetura.md` §7 promete *"unitário de aplicação… sem banco?
 * **Sim (repositório em memória)**"* desde que foi escrita, e esse teste **não tinha como existir**: sem um
 * tipo comum entre o repositório real e o duplo, substituir vira *mock* de módulo, e o teste passa a
 * depender do empacotador.
 *
 * Com a porta declarada pela camada que a consome, substituir o repositório é **passar outro argumento**.
 * É o princípio de substituição de Liskov no seu uso literal (arquitetura.md §5.6).
 *
 * Nenhum arquivo aqui importa `infraestrutura/`, `pg` ou `@supabase/*` — e o lint recusaria se importasse.
 */

// ---------------------------------------------------------------------------

export type PessoaSemeada = {
  pessoaId: string;
  usuarioId: string | null;
  nome: string;
};

export type VinculoSemeado = {
  pessoaId: string;
  organizacaoId: string;
  organizacaoNome: string;
  codigoPublico: string;
  papel: Papel;
  revogado?: boolean;
};

export type Semente = {
  pessoas?: readonly PessoaSemeada[];
  vinculos?: readonly VinculoSemeado[];
  /** Os pedidos que a leitura global devolve. A ordem é a que o teste escrever. */
  pedidos?: readonly PedidoDaPessoa[];
};

/** O que o teste inspeciona depois de rodar — o rastro que os duplos deixam. */
export type Rastro = {
  /** Quantas Pessoas o ACL criou. É o que prova a idempotência da §9.2 do modelo. */
  pessoasCriadas: number;
  /** As consultas de vínculo, na ordem, com a Pessoa por que partiram. */
  consultasDeVinculo: string[];
  /** As consultas de pedidos de entrada, na ordem, com a Pessoa por que partiram. */
  consultasDePedido: string[];
};

export type Duplos = {
  portas: PortasGlobais;
  rastro: Rastro;
  /** Lê o estado da tabela `pessoas` do duplo — o que o teste confere no fim. */
  pessoas(): readonly PessoaSemeada[];
};

/**
 * O duplo da porta de leitura de pedidos. **Substituição pela porta**, não *mock* de módulo (ADR-0005).
 *
 * Devolve a lista tal como recebeu: a ordenação é responsabilidade da consulta, e o teste de que ela
 * ordena é o de integração — aqui provar ordenação seria provar que o duplo ordena.
 */
export function pedidosGlobaisFalsos(
  rastro: Rastro,
  pedidos: readonly PedidoDaPessoa[] = [],
): RepositorioGlobalDePedidosDeEntrada {
  return {
    async daPessoa(pessoaId) {
      // Mesmo mecanismo de `repositorioGlobalDeVinculos` logo abaixo: registra por qual Pessoa a consulta
      // partiu. Sem isto, `resolverContexto` poderia passar `sessao.usuarioId` em vez de `pessoa.pessoaId`
      // e nenhum teste em memória perceberia.
      rastro.consultasDePedido.push(pessoaId);
      return [...pedidos];
    },
  };
}

/**
 * O duplo da porta de **escrita**. Está aqui pela mesma razão que `organizacoes` já está: `PortasGlobais`
 * o exige, e `resolverContexto` **nunca o exerce**. Quem o exerce é o teste de `pedirEntrada`, que monta o
 * seu próprio (tarefa 3) para poder inspecionar o que a porta recebeu.
 */
export function escritaDePedidosFalsa(): RepositorioDePedidosDeEntrada {
  return {
    registrar: () => Promise.reject(new Error("porta de escrita não exercida por este duplo")),
  };
}

/**
 * Monta o grafo à mão, que é o que os testes podem fazer e a Aplicação não (ADR-0005).
 *
 * @param sessao o que o provedor de autenticação devolve. `null` é *não há sessão*.
 */
export function montarDuplos(sessao: SessaoDoProvedor | null, semente: Semente = {}): Duplos {
  const pessoas: PessoaSemeada[] = [...(semente.pessoas ?? [])];
  const vinculos: VinculoSemeado[] = [...(semente.vinculos ?? [])];

  const rastro: Rastro = { pessoasCriadas: 0, consultasDeVinculo: [], consultasDePedido: [] };

  const autenticacao: PortaDeAutenticacao = {
    sessaoAtual: () => Promise.resolve(sessao),
  };

  const repositorioDePessoas: RepositorioDePessoas = {
    porUsuario(usuarioId) {
      const achada = pessoas.find((p) => p.usuarioId === usuarioId);
      return Promise.resolve(achada === undefined ? null : referencia(achada));
    },

    /**
     * O `insert … on conflict (usuario_id) … returning` do repositório real, em memória: se já existe
     * Pessoa para aquele Usuário, devolve a existente e **não cria uma segunda**.
     */
    garantirParaUsuario(usuarioId, nome) {
      const existente = pessoas.find((p) => p.usuarioId === usuarioId);
      if (existente !== undefined) return Promise.resolve(referencia(existente));

      const nova: PessoaSemeada = { pessoaId: `pessoa-${pessoas.length + 1}`, usuarioId, nome };
      pessoas.push(nova);
      rastro.pessoasCriadas += 1;
      return Promise.resolve(referencia(nova));
    },

    /**
     * O `update pessoas set nome = $2 where id = $1` do repositório real, em memória. **Escreve na
     * lista compartilhada**, que é o que faz o teste do efeito global ver o nome novo pelas duas
     * organizações sem que nada mais mude.
     */
    renomear(pessoaId, nome) {
      const alvo = pessoas.find((p) => p.pessoaId === pessoaId);
      if (alvo === undefined) {
        return Promise.reject(new Error(`o duplo não tem Pessoa ${pessoaId}`));
      }
      alvo.nome = nome;
      return Promise.resolve(referencia(alvo));
    },
  };

  const repositorioGlobalDeVinculos: RepositorioGlobalDeVinculos = {
    ativosDaPessoa(pessoaId) {
      // **A consulta parte da Pessoa, e é isso que o teste do A4 confere.** O duplo registra por qual
      // Pessoa ela partiu; um caminho que partisse de `pessoas` e filtrasse depois não apareceria aqui —
      // e é por isso que o teste de isolamento confere o *resultado*, não só a chamada.
      rastro.consultasDeVinculo.push(pessoaId);

      const ativos = vinculos
        .filter((v) => v.pessoaId === pessoaId && v.revogado !== true)
        .map(
          (v): VinculoNaOrganizacao => ({
            vinculo: Vinculo.de(v.pessoaId, v.organizacaoId, v.papel),
            organizacao: {
              id: v.organizacaoId,
              nome: v.organizacaoNome,
              codigoPublico: v.codigoPublico,
            },
          }),
        )
        .sort((a, b) => a.organizacao.nome.localeCompare(b.organizacao.nome, "pt-BR"));

      return Promise.resolve(ativos);
    },
  };

  return {
    portas: {
      autenticacao,
      pessoas: repositorioDePessoas,
      vinculos: repositorioGlobalDeVinculos,
      // Presente para satisfazer o pacote, e **nunca exercida por este duplo**: `resolverContexto` não
      // cria organização. Quem exerce a porta é `duploDeOrganizacoes` acima, montado pelo próprio teste
      // de `criarOrganizacao` — que inspeciona o que a porta recebeu, e por isso não a quer compartilhada.
      organizacoes: duploDeOrganizacoes().porta,
      pedidosDeEntrada: pedidosGlobaisFalsos(rastro, semente.pedidos),
      escritaDePedidosDeEntrada: escritaDePedidosFalsa(),
    },
    rastro,
    pessoas: () => pessoas,
  };
}

/**
 * A escolha de organização que a camada de Interface entrega.
 *
 * No código real ela lê o cookie assinado e **amarrado ao `usuarioId`**; aqui é um mapa, e a amarração é
 * a mesma: a escolha de um usuário não vale para outro.
 */
export function escolhaDaSessao(porUsuario: Readonly<Record<string, string>> = {}): EscolhaDaSessao {
  return { organizacaoEscolhida: (usuarioId) => porUsuario[usuarioId] ?? null };
}

function referencia(pessoa: PessoaSemeada): PessoaReferencia {
  return { pessoaId: pessoa.pessoaId, nome: pessoa.nome };
}

/** O que o teste inspeciona depois de chamar `criarOrganizacao`. */
export type DuploDeOrganizacoes = {
  porta: RepositorioDeOrganizacoes;
  /** Cada `NovaOrganizacao` que a porta recebeu, na ordem. É o rastro do sorteio. */
  recebidas: NovaOrganizacao[];
};

/**
 * O duplo do repositório de organizações.
 *
 * **As contagens que ele devolve são do que recebeu**, e não constantes: é o que faz o teste de aplicação
 * provar que a Aplicação não inventa o número. Quem prova que o banco inseriu aquilo é a integração.
 */
export function duploDeOrganizacoes(
  comportamento: { recusarAsPrimeiras?: number; falharCom?: Error } = {},
): DuploDeOrganizacoes {
  const recebidas: NovaOrganizacao[] = [];
  const recusar = comportamento.recusarAsPrimeiras ?? 0;

  const porta: RepositorioDeOrganizacoes = {
    criar(nova) {
      recebidas.push(nova);

      if (comportamento.falharCom !== undefined) return Promise.reject(comportamento.falharCom);
      if (recebidas.length <= recusar) return Promise.reject(new CodigoPublicoEmUso(nova.codigoPublico));

      return Promise.resolve({
        id: `organizacao-${recebidas.length}`,
        nome: nova.nome,
        codigoPublico: nova.codigoPublico,
        criadoEm: "2026-08-23T12:00:00.000Z",
        categoriasSemeadas: nova.categorias.length,
        areasSemeadas: nova.areas.length,
      });
    },
  };

  return { porta, recebidas };
}

// ---------------------------------------------------------------------------
// Anexo — o livro-caixa e o emissor
// ---------------------------------------------------------------------------

/** O livro-caixa em memória, com a mesma janela deslizante do SQL. */
export function livroEmMemoria(): LivroDeAutorizacoesDeUpload & { emissoesDe(pessoaId: string): number } {
  const emissoes = new Map<string, number[]>();

  return {
    emissoesDe: (pessoaId) => emissoes.get(pessoaId)?.length ?? 0,

    async registrarSeCouber(pessoaId, limite, janelaEmSegundos) {
      const agora = Date.now();
      const inicio = agora - janelaEmSegundos * 1000;

      const naJanela = (emissoes.get(pessoaId) ?? []).filter((quando) => quando > inicio);

      if (naJanela.length >= limite) {
        const maisAntiga = Math.min(...naJanela);
        const segundos = Math.ceil((maisAntiga + janelaEmSegundos * 1000 - agora) / 1000);
        emissoes.set(pessoaId, naJanela);
        return { concedida: false, segundosAteLiberar: Math.max(1, segundos) };
      }

      emissoes.set(pessoaId, [...naJanela, agora]);
      return { concedida: true };
    },
  };
}

/**
 * O emissor falso. **Não assina nada** — devolve a forma, que é o que o caso de uso orquestra. Que a
 * assinatura seja válida é problema do adaptador, e o teste dele é outro.
 */
export function emissorFalso(): EmissorDeCredencialDeUpload {
  let contador = 0;

  return {
    async emitir(pedido) {
      contador += 1;
      const chave = `anx_falso_${contador}`;
      const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const destino = (nome: string, tipo: string) => ({
        url: `http://storage.invalido/anexos/${nome}?sig=falsa`,
        metodo: "PUT" as const,
        cabecalhos: {
          "x-ms-blob-type": "BlockBlob",
          "x-ms-blob-content-type": tipo,
          "x-ms-tags": "estado=pendente",
        },
        expiraEm,
      });

      return {
        chave,
        chaveMiniatura: `${chave}_mini`,
        ticket: `ticket-de-${pedido.pessoaId}-${contador}`,
        upload: destino(chave, pedido.tipoConteudo),
        uploadMiniatura: destino(`${chave}_mini`, "image/webp"),
      };
    },
  };
}
