import { Badge } from "@/interface/componentes/ui/badge";

/** A forma neutra das três — contorno. */
const CONTORNO = "border-linha text-tinta bg-transparent";

const FORMA_DO_SELO: Readonly<Record<string, string>> = {
  aberta: "bg-accent text-accent-foreground border-transparent",
  pausada: "bg-accent text-accent-foreground border-transparent",
  em_analise: CONTORNO,
  em_atendimento: CONTORNO,
  resolvida: "bg-muted text-tinta-suave border-transparent",
  cancelada: "bg-muted text-tinta-suave border-transparent",
};

/**
 * **O selo de status, escrito uma vez.** Aparece em T-03 e em T-05.
 *
 * Guia §2 — três formas, e a forma diz se a ocorrência espera alguém; a palavra diz qual é o estado:
 *
 * | Forma | Status |
 * |---|---|
 * | Sólido | Aberta · Pausada |
 * | Contorno | Em análise · Em atendimento |
 * | Apagado | Resolvida · Cancelada |
 *
 * **O sólido usa `bg-accent`, que neste repositório resolve para `--accent-bg`** — o par de fundo do
 * vocabulário —, com `--accent-foreground` por cima. **A cor da marca não entra aqui:** ela é
 * `--color-marca`, e só a ação principal a veste.
 *
 * **E o sólido não pode usar `--chrome` nem `--sunken`, que são o mesmo valor nos dois temas**: o sólido
 * e o apagado ficariam com o mesmo fundo, separados só pela cor do texto, e as três formas virariam duas
 * e meia.
 *
 * **O raio é o de selo, 6 px.** O `ui/badge` chega do catálogo com `rounded-full`, que o guia §4 não
 * concede a selo nenhum.
 *
 * **Nada é comunicado só por forma:** o selo sempre imprime o `statusRotulo`, que vem pronto do servidor
 * na coluna de quem lê (item 31).
 *
 * **`status` é `string` porque `app/` não importa o Domínio** (ADR-0006). Status desconhecido cai no
 * contorno, que é a forma neutra das três.
 *
 * **E esse é o preço da regra.** `FORMA_DO_SELO` já foi `Record<StatusOcorrencia, string>`; trocar por
 * `Record<string, string>` custou a exaustividade do `tsc` — um sétimo status entraria em silêncio no
 * contorno em vez de falhar o build. É o custo declarado da ADR-0006, que mantém `app/` sem o Domínio.
 */
export function SeloDeStatus({ status, rotulo }: { status: string; rotulo: string }) {
  return (
    <Badge variant="outline" className={`text-meta rounded-sm ${FORMA_DO_SELO[status] ?? CONTORNO}`}>
      {rotulo}
    </Badge>
  );
}
