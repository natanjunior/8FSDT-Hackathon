import type { PessoaReferencia, RepositorioDePessoas } from "@/aplicacao/contexto";
import type { Consulta } from "@/infraestrutura/clientes";

/**
 * Implementa a porta `RepositorioDePessoas`.
 *
 * **Devolve `PessoaReferencia` — objeto de leitura declarado —, nunca a linha de `pessoas`** (ADR-0005,
 * parte 3). A coluna `anonimizada_em` existe e não sai daqui; `criado_em` e `atualizado_em` também não.
 * A porta pede identificador e nome, e é isso que ela recebe.
 *
 * `pessoas` é **tabela global** (modelo §4.1): não tem `organizacao_id`, e portanto não há escopo a
 * aplicar. É por isso que este repositório não é escopado — e é exatamente por isso que **nenhuma
 * listagem parte daqui** (contrato §4.6): as três operações abaixo são pontuais, duas por `usuario_id`,
 * que é a chave que a sessão traz, e a terceira por `id`, que é a Pessoa que a resolução de contexto
 * acabou de devolver. Nenhuma listagem parte daqui, e é isso que o DoD cobra — a regra é sobre listar
 * gente, e o defeito que ela previne é uma consulta que devolve o cadastro do sistema inteiro.
 */
export function repositorioDePessoas(consulta: Consulta): RepositorioDePessoas {
  return {
    async porUsuario(usuarioId) {
      const linhas = await consulta<{ id: string; nome: string }>(
        `select id, nome from pessoas where usuario_id = $1`,
        [usuarioId],
      );
      const linha = linhas[0];
      return linha === undefined ? null : projetar(linha);
    },

    /**
     * A resolução idempotente da §9.2 do modelo de dados.
     *
     * `on conflict (usuario_id)` é o que torna a operação idempotente **no banco** em vez de numa
     * checagem-e-depois-insere, que perderia a corrida entre duas requisições do mesmo primeiro login.
     * O `do update` é um no-op cujo único papel é fazer o `returning` devolver a linha existente.
     */
    async garantirParaUsuario(usuarioId, nome) {
      const linhas = await consulta<{ id: string; nome: string }>(
        `insert into pessoas (usuario_id, nome)
              values ($1, $2)
         on conflict (usuario_id)
              do update set usuario_id = excluded.usuario_id
          returning id, nome`,
        [usuarioId, nome],
      );

      const linha = linhas[0];
      if (linha === undefined) {
        throw new Error("insert ... on conflict ... returning não devolveu linha — invariante violada");
      }
      return projetar(linha);
    },

    /**
     * `PATCH /contexto/pessoa` — item 49. **Cópia literal do `update` que `pedidos-de-entrada.ts` já
     * faz**, que é o único outro escritor de `pessoas.nome`. O relógio de `atualizado_em` é carimbado
     * pelo gatilho da migração `012`, e esta instrução não o menciona.
     *
     * **`where id = $1`, e o `$1` vem da sessão resolvida.** Não há filtro de organização a aplicar —
     * `pessoas` é global (modelo §6.2) — e não há identificador que quem chama possa escolher: o
     * endpoint não tem `{pessoaId}` no caminho.
     */
    async renomear(pessoaId, nome) {
      const linhas = await consulta<{ id: string; nome: string }>(
        `update pessoas
            set nome = $2
          where id = $1
      returning id, nome`,
        [pessoaId, nome],
      );

      const linha = linhas[0];
      // **Zero linhas não é desfecho de domínio**, e é a mesma leitura de `organizacao-escopada.ts`: a
      // Pessoa é a da sessão, e a sessão só existe porque o ACL acabou de garanti-la.
      if (linha === undefined) {
        throw new Error("o update de pessoa não devolveu linha — invariante violada");
      }
      return projetar(linha);
    },
  };
}

function projetar(linha: { id: string; nome: string }): PessoaReferencia {
  return { pessoaId: linha.id, nome: linha.nome };
}
