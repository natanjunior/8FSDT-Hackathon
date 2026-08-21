/**
 * **O cold start, onde ele aparece pela primeira vez** (RNF5, escala a zero).
 *
 * A regra do inventário (§6): *"a primeira requisição de uma sessão tem espera nomeada; as seguintes têm
 * estrutura de espera silenciosa"*. E o texto é literal: *"Acordando o servidor — a primeira abertura do dia
 * é mais lenta."*
 *
 * Isso não é decoração: *"um giro de oito segundos sem explicação lê-se como defeito, e o RNF5 declara o
 * cold start como esperado, não como imprevisto"*.
 *
 * **A frase espera ~2 s antes de aparecer**, como o protótipo especifica, e a espera é feita com atraso de
 * animação em CSS — sem JavaScript, porque nesta tela não há JavaScript nosso rodando ainda: é justamente a
 * espera pelo servidor. E o texto **não promete prazo**, o que o faz servir também para o banco pausado há
 * sete dias.
 */
export default function EsperandoOContexto() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-6 pt-10 pb-12">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>

      {/* Esqueleto com a forma da tela — não um giro genérico. */}
      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-6 w-[70%] animate-pulse rounded" />
        <div className="bg-secondary h-4 w-[38%] animate-pulse rounded" />
        <div className="bg-secondary h-12 animate-pulse rounded" />
        <div className="bg-secondary h-4 w-[55%] animate-pulse rounded" />
        <div className="bg-secondary h-12 animate-pulse rounded" />
      </div>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-sm opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </main>
  );
}
