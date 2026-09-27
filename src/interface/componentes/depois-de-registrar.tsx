import { DEPOIS_DE_REGISTRAR } from "@/interface/componentes/registro-de-ocorrencia";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  *Depois de registrar* — o painel da tela grande de T-04 (item 44l)
 * ============================================================================
 *
 * **A `ReguaDoCiclo` de T-05 não é reusada, e é decisão.** Ela é dirigida por transições reais e imprime
 * a data de cada passo alcançado em monoespaçada, que o guia §3 reserva para dado temporal. Aqui **não
 * existe ocorrência ainda**: para escrever *"nasce assim"* no lugar da data eu teria de inventar uma
 * transição falsa e pôr uma frase no papel do número. São vinte linhas que não mentem. *(Se um dia o
 * painel precisar de datas, ele vira chamada da régua.)*
 *
 * **Os nomes dos estados passam pela lente do item 31**, e quem a aplica é a página: o Solicitante lê
 * *"Em execução"* onde o Gestor lê *"Em atendimento"*. Passar a coluna do Gestor a todo mundo desfaria o
 * item 31 dentro de um item de forma.
 *
 * **A tela não diz que outros moradores vão ver a ocorrência** (critério 44l.12). A D10 diz isso de área
 * comum, mas *"Ver as ocorrências de área comum do meu local"* está ⬜ no `escopo.md`, e hoje o
 * Solicitante vê só as próprias. O *"do condomínio"* que a prancheta escreve também sai: pela D3, a
 * organização **é** o local, e ela pode ser empresa ou bairro.
 *
 * **Componente de servidor.** Sem estado, e não lê nada do navegador.
 */
export function DepoisDeRegistrar({ passos }: { readonly passos: readonly string[] }) {
  return (
    <aside
      aria-labelledby="depois-de-registrar"
      className="border-linha bg-superficie rounded-lg border p-5 shadow-sm"
    >
      <h2
        id="depois-de-registrar"
        className="text-titulo-bloco text-tinta mb-4"
      >
        {DEPOIS_DE_REGISTRAR.titulo}
      </h2>

      <ol className="flex flex-col gap-3">
        {passos.map((passo, indice) => (
          <li key={passo} className="flex items-baseline gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 size-[11px] shrink-0 rounded-full border",
                indice === 0
                  ? "bg-tinta border-tinta ring-tinta/20 ring-4"
                  : "border-linha bg-transparent",
              )}
            />
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                className={cn(
                  "text-interface",
                  indice === 0 ? "text-tinta font-medium" : "text-tinta-suave",
                )}
              >
                {passo}
              </span>
              {indice === 0 && (
                <span className="text-meta text-tinta-suave">{DEPOIS_DE_REGISTRAR.nasce}</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-corpo text-tinta-suave mt-4">
        {DEPOIS_DE_REGISTRAR.explicacao}
      </p>
      <p className="text-meta text-tinta-suave border-linha-suave mt-4 border-t pt-3.5">
        {DEPOIS_DE_REGISTRAR.acompanha}
      </p>
    </aside>
  );
}
