const CICLO = ["aberta", "em_analise", "em_atendimento", "resolvida"] as const;

export type EtapaAlcancada = { status: string; em: string };

/**
 * **O ciclo do enunciado, visível pela primeira vez numa tela.**
 *
 * `Aberta → Em análise → Em atendimento → Resolvida`, com os alcançados trazendo data e o próximo por
 * alcançar. **Pausada e cancelada ficam fora da linha:** pausada é estado sobre o atendimento, cancelada é
 * saída — nenhuma das duas é etapa do caminho.
 *
 * Ela nasce aqui, e não em T-05, porque peça compartilhada que nasce dentro de uma tela é peça que a
 * segunda tela copia. O 44d a consome no primeiro dia.
 */
export function ReguaDoCiclo({
  alcancadas,
  statusAtual,
  nomeDoStatus,
}: {
  alcancadas: readonly EtapaAlcancada[];
  statusAtual: string;
  nomeDoStatus: (status: string) => string;
}) {
  const foraDaLinha = statusAtual === "pausada" || statusAtual === "cancelada";

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-2">
        {CICLO.map((etapa) => {
          const alcancada = alcancadas.find((a) => a.status === etapa);
          return (
            <li key={etapa} className="flex items-center gap-2">
              <span
                className={
                  alcancada === undefined
                    ? "text-tinta-fraca text-meta"
                    : "text-tinta text-meta font-medium"
                }
              >
                {nomeDoStatus(etapa)}
                {alcancada !== undefined && (
                  <span className="text-tinta-suave font-mono"> · {alcancada.em}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {foraDaLinha && (
        <p className="text-tinta-suave text-meta mt-2">
          {statusAtual === "pausada" ? "Atendimento pausado." : "Ocorrência cancelada — fora do ciclo."}
        </p>
      )}
    </div>
  );
}
