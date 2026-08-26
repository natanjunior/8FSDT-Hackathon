import type { LivroDeAutorizacoesDeUpload, ResultadoDoLimite } from "@/aplicacao/anexo";
import type { Transacao } from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  O livro-caixa de emissão — **a única consulta do projeto que NÃO passa pelo
 *  repositório escopado, e é decisão**
 * ============================================================================
 *
 * O limite protege a **conta de armazenamento**, que é uma só para todas as organizações. Escopar por
 * organização daria 60/h a quem tem dois vínculos, e transformaria *"entrar em outra organização"* num
 * jeito de dobrar a franquia. O critério 13a.3 diz *"a mesma **Pessoa** na mesma hora"*, e `pessoas` é
 * global — a tabela segue a Pessoa.
 *
 * Por isso este arquivo recebe `Transacao` crua, e **não** `escoparTransacao`.
 *
 * **E é preciso ser exato sobre o que aconteceria se recebesse**, porque o erro seria silencioso: a trava
 * do `escopo.ts` só confere que o SQL **tem um `$1`** — e este tem, é a `pessoa_id`. Ela **não recusaria**
 * nada. O que faria seria empurrar `organizacaoId` para `$1` e deslocar todos os outros parâmetros: a
 * consulta contaria a janela de uma organização tratada como Pessoa, e passaria nos testes que não olham o
 * número. **A defesa aqui não é a trava; é não passar pela função escopada.**
 *
 * **E nada no caminho de reivindicação lê daqui.** É o que preserva a suposição S-A13 do contrato: o
 * `ticket` continua sendo token assinado, e o item 13b confere assinatura e `HEAD` no objeto.
 */
export function livroDeAutorizacoesDeUpload(transacao: Transacao): LivroDeAutorizacoesDeUpload {
  return {
    async registrarSeCouber(pessoaId, limite, janelaEmSegundos): Promise<ResultadoDoLimite> {
      const janela = `${janelaEmSegundos} seconds`;

      return transacao(async (consulta) => {
        // 1 · Limpeza oportunista. Roda dentro da mesma transação, então a contagem seguinte já a
        //     enxerga. A tabela nunca passa de (pessoas ativas na última hora x 30) linhas — uma varredura
        //     aqui é mais barata que o índice que ela evitaria.
        await consulta(`delete from autorizacoes_de_upload where emitida_em < now() - $1::interval`, [
          janela,
        ]);

        // 2 · Contar e gravar na MESMA instrução. Separá-las abriria, entre uma e outra, a janela em que a
        //     segunda réplica concede a mesma vaga. O `insert ... select ... where` grava zero linhas
        //     quando a janela está cheia, e é o `returning` que diz qual dos dois aconteceu.
        const gravadas = await consulta<{ id: string }>(
          `insert into autorizacoes_de_upload (pessoa_id)
           select $1::uuid
            where (
              select count(*)
                from autorizacoes_de_upload
               where pessoa_id = $1::uuid
                 and emitida_em > now() - $2::interval
            ) < $3
           returning id`,
          [pessoaId, janela, limite],
        );

        if (gravadas.length === 1) return { concedida: true };

        // 3 · Só no caminho recusado: quanto falta para a mais antiga da janela sair dela. É o
        //     `Retry-After` que o `openapi.yaml` declara neste `429`.
        const [linha] = await consulta<{ segundos: string | null }>(
          `select ceil(extract(epoch from (min(emitida_em) + $2::interval - now())))::text as segundos
             from autorizacoes_de_upload
            where pessoa_id = $1::uuid
              and emitida_em > now() - $2::interval`,
          [pessoaId, janela],
        );

        // Piso de 1: `Retry-After: 0` convida a repetir na mesma hora, e é o cabeçalho pedindo a tempestade
        // que ele existe para evitar.
        return {
          concedida: false,
          segundosAteLiberar: Math.max(1, Number(linha?.segundos ?? 1)),
        };
      });
    },
  };
}
