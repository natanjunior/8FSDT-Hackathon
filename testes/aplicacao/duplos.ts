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
};

/** O que o teste inspeciona depois de rodar — o rastro que os duplos deixam. */
export type Rastro = {
  /** Quantas Pessoas o ACL criou. É o que prova a idempotência da §9.2 do modelo. */
  pessoasCriadas: number;
  /** As consultas de vínculo, na ordem, com a Pessoa por que partiram. */
  consultasDeVinculo: string[];
};

export type Duplos = {
  portas: PortasGlobais;
  rastro: Rastro;
  /** Lê o estado da tabela `pessoas` do duplo — o que o teste confere no fim. */
  pessoas(): readonly PessoaSemeada[];
};

/**
 * Monta o grafo à mão, que é o que os testes podem fazer e a Aplicação não (ADR-0005).
 *
 * @param sessao o que o provedor de autenticação devolve. `null` é *não há sessão*.
 */
export function montarDuplos(sessao: SessaoDoProvedor | null, semente: Semente = {}): Duplos {
  const pessoas: PessoaSemeada[] = [...(semente.pessoas ?? [])];
  const vinculos: VinculoSemeado[] = [...(semente.vinculos ?? [])];

  const rastro: Rastro = { pessoasCriadas: 0, consultasDeVinculo: [] };

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
