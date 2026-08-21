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
 * listagem parte daqui** (contrato §4.6): as duas consultas abaixo são pontuais, por `usuario_id`, que é
 * a chave que a sessão traz.
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
  };
}

function projetar(linha: { id: string; nome: string }): PessoaReferencia {
  return { pessoaId: linha.id, nome: linha.nome };
}
