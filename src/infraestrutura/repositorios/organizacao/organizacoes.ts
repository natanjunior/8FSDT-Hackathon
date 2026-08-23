import {
  CodigoPublicoEmUso,
  type NovaOrganizacao,
  type OrganizacaoCriada,
  type RepositorioDeOrganizacoes,
} from "@/aplicacao/organizacao";
import type { Transacao } from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  A POL-01 em SQL — quatro escritas, um `COMMIT`
 * ============================================================================
 *
 * **A ordem não é escolha:** a organização entra primeiro porque o vínculo precisa do `organizacao_id`
 * para existir; a FK `(criada_por_pessoa_id, id)` de `organizacoes` para `vinculos` aponta na direção
 * contrária, e é `DEFERRABLE INITIALLY DEFERRED` exatamente por isso (modelo §6.3). Fora de uma
 * transação, a primeira linha seria recusada na hora.
 *
 * **Este repositório não sabe o que é a semente.** As duas listas chegam prontas: o conteúdo é decisão do
 * domínio (§14.1 e §14.2), e a única coisa que este arquivo faz com elas é inserir e contar.
 */
export function repositorioDeOrganizacoes(emTransacao: Transacao): RepositorioDeOrganizacoes {
  return {
    async criar(nova: NovaOrganizacao): Promise<OrganizacaoCriada> {
      try {
        return await emTransacao(async (consulta) => {
          const criadas = await consulta<{
            id: string;
            nome: string;
            codigo_publico: string;
            criado_em: Date;
          }>(
            `insert into organizacoes (nome, codigo_publico, criada_por_pessoa_id)
                  values ($1, $2, $3)
               returning id, nome, codigo_publico, criado_em`,
            [nova.nome, nova.codigoPublico, nova.criadaPorPessoaId],
          );

          const organizacao = criadas[0];
          if (organizacao === undefined) {
            throw new Error("insert ... returning não devolveu linha — invariante violada");
          }

          // O bootstrap da D26: quem cria vira o Gestor inicial, porque não há quem o aprove.
          await consulta(
            `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
            [nova.criadaPorPessoaId, organizacao.id],
          );

          // `unnest` de arrays paralelos preserva a ordem, e o `returning` conta o que ENTROU — que é o
          // que torna `categoriasSemeadas` capaz de detectar semente parcial (modelo §14.3). As colunas
          // de autoria ficam nulas: quem criou foi a política.
          const categorias = await consulta<{ id: string }>(
            `insert into categorias (organizacao_id, nome, icone, ordem)
             select $1, s.nome, s.icone, s.ordem
               from unnest($2::text[], $3::text[], $4::smallint[]) as s(nome, icone, ordem)
             returning id`,
            [
              organizacao.id,
              nova.categorias.map((c) => c.nome),
              nova.categorias.map((c) => c.icone),
              nova.categorias.map((c) => c.ordem),
            ],
          );

          const areas = await consulta<{ id: string }>(
            `insert into areas (organizacao_id, nome, tipo, ordem)
             select $1, s.nome, s.tipo, s.ordem
               from unnest($2::text[], $3::tipo_area[], $4::smallint[]) as s(nome, tipo, ordem)
             returning id`,
            [
              organizacao.id,
              nova.areas.map((a) => a.nome),
              nova.areas.map((a) => a.tipo),
              nova.areas.map((a) => a.ordem),
            ],
          );

          return {
            id: organizacao.id,
            nome: organizacao.nome,
            codigoPublico: organizacao.codigo_publico,
            criadoEm: organizacao.criado_em.toISOString(),
            categoriasSemeadas: categorias.length,
            areasSemeadas: areas.length,
          };
        });
      } catch (erro) {
        if (ehCodigoPublicoDuplicado(erro)) throw new CodigoPublicoEmUso(nova.codigoPublico);
        throw erro;
      }
    },
  };
}

/**
 * A violação do `UNIQUE (codigo_publico)`, traduzida em recusa nomeada.
 *
 * **Lê `code` e `constraint` de um objeto desconhecido, sem importar o driver** — a regra de fronteira
 * reserva o SDK a `infraestrutura/clientes/` (ADR-0006, regra 1), e ler duas propriedades não exige o
 * tipo. Confere as **duas**: `23505` sozinho pegaria também o nome de categoria repetido, que é outra
 * história e não deve virar uma retentativa de sorteio.
 */
function ehCodigoPublicoDuplicado(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  const comCodigo = erro as { code?: unknown; constraint?: unknown };
  return comCodigo.code === "23505" && comCodigo.constraint === "organizacoes_codigo_publico_uk";
}
