import type {
  DesfechoDoRegistro,
  RepositorioEscopadoDeEnviosDeConvite,
  ResumoDosEnvios,
} from "@/aplicacao/organizacao";
import { ENVIOS_POR_PARTICIPANTE } from "@/dominio/organizacao";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

import { INSERIR_SE_NAO_HA_VIVO, SELECIONAR_VIVO, projetarVivo, type LinhaDoVivo } from "./convites-pessoais-escopados";

/**
 * ============================================================================
 *  Os envios do convite por e-mail — item 122
 * ============================================================================
 *
 * **Grava, envia, e só confirma se saiu.** Cada pessoa tem a própria transação: o convite vivo é garantido
 * e travado, os dois limites são conferidos, a linha é inserida, e só então o provedor é chamado. Se ele
 * recusar, a transação desfaz, e o envio que falhou não conta para limite nenhum. **A transação fica aberta
 * durante a chamada ao provedor**, alguns centésimos a poucos segundos por pessoa: é o custo aceito para a
 * tabela ser o que saiu, e não o que se tentou.
 *
 * **Os limites são do banco.** O de um por dia por endereço é o índice único `envios_de_convite_dia_uk`;
 * o de dez por participante é contagem, com o convite vivo travado para dois envios não virarem onze.
 *
 * Nenhuma função daqui faz `update` nem `delete` em `envios_de_convite`: a tabela só cresce.
 */

/** Sentinela interna: rejeitar dentro da transação é o que a faz desfazer. Nunca sai deste arquivo. */
class EntregaRecusada extends Error {}

const HOJE_EM_BRASILIA = `(now() at time zone 'America/Sao_Paulo')::date`;

export function repositorioEscopadoDeEnviosDeConvite(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeEnviosDeConvite {
  return {
    async registrarEnvio({ pessoaId, email, porPessoaId, token, entregar }) {
      try {
        return await emTransacao<DesfechoDoRegistro>(async (dentro) => {
          // 1 · Garante o vivo e o trava. A trava serializa dois envios à mesma pessoa, e com ela a contagem
          //     de dez não vira onze. O `renovar` do convite espera esta trava.
          await dentro(INSERIR_SE_NAO_HA_VIVO, [pessoaId, token, porPessoaId]);
          const [vivo] = await dentro<LinhaDoVivo>(`${SELECIONAR_VIVO} for update of c`, [pessoaId]);
          if (vivo === undefined) {
            throw new Error("registrarEnvio não achou o vivo depois de garantir — invariante violada");
          }

          // 2 · Dez por participante: todo envio de todo convite deste vínculo, inclusive os invalidados.
          const [contagem] = await dentro<{ n: number }>(
            `select count(*)::int as n
               from envios_de_convite e
               join convites_pessoais c on c.id = e.convite_pessoal_id and c.organizacao_id = e.organizacao_id
              where e.organizacao_id = $1 and c.pessoa_id = $2`,
            [pessoaId],
          );
          if ((contagem?.n ?? 0) >= ENVIOS_POR_PARTICIPANTE) {
            // Quando os dois limites valem, a tela diz o do dia, que vem antes na ordem dos motivos.
            const [hoje] = await dentro<{ ja: boolean }>(
              `select exists (select 1 from envios_de_convite
                               where organizacao_id = $1 and lower(email) = lower($2)
                                 and dia = ${HOJE_EM_BRASILIA}) as ja`,
              [email],
            );
            return { desfecho: hoje?.ja === true ? "limite-do-dia" : "limite-do-participante" };
          }

          // 3 · Um por dia por endereço: quem decide é o índice. `do nothing` espera a transação que segura o
          //     mesmo endereço e, se ela confirmar, não insere.
          const [inserida] = await dentro<{ enviado_em: Date }>(
            `insert into envios_de_convite (organizacao_id, convite_pessoal_id, email, enviado_por_pessoa_id)
             values ($1, $2, $3, $4)
             on conflict (organizacao_id, lower(email), dia) do nothing
             returning enviado_em`,
            [vivo.id, email, porPessoaId],
          );
          if (inserida === undefined) return { desfecho: "limite-do-dia" };

          // 4 · Fala com o provedor com a transação aberta.
          try {
            await entregar(projetarVivo(vivo));
          } catch {
            throw new EntregaRecusada();
          }
          return { desfecho: "enviado", enviadoEm: inserida.enviado_em.toISOString() };
        });
      } catch (erro) {
        if (erro instanceof EntregaRecusada) return { desfecho: "falha-no-envio" };
        throw erro;
      }
    },

    async resumoDe(pessoaId, email): Promise<ResumoDosEnvios> {
      const [linha] = await consulta<{ ultimo: Date | null; n: number; hoje: boolean }>(
        `select (select max(e.enviado_em)
                   from envios_de_convite e
                   join convites_pessoais c on c.id = e.convite_pessoal_id and c.organizacao_id = e.organizacao_id
                  where e.organizacao_id = $1 and c.pessoa_id = $2) as ultimo,
                (select count(*)::int
                   from envios_de_convite e
                   join convites_pessoais c on c.id = e.convite_pessoal_id and c.organizacao_id = e.organizacao_id
                  where e.organizacao_id = $1 and c.pessoa_id = $2) as n,
                ($3::text is not null and exists (
                   select 1 from envios_de_convite
                    where organizacao_id = $1 and lower(email) = lower($3::text)
                      and dia = ${HOJE_EM_BRASILIA})) as hoje`,
        [pessoaId, email],
      );
      return {
        ultimoEnvioEm: linha?.ultimo?.toISOString() ?? null,
        doParticipante: linha?.n ?? 0,
        enderecoJaRecebeuHoje: linha?.hoje === true,
      };
    },
  };
}
