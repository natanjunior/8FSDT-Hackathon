import { Ban, Check, FilePlus, Pause, Search, Wrench } from "lucide-react";

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
 * ============================================================================
 *  O marcador do trilho de T-06 — item 44n, critério 6
 * ============================================================================
 *
 * **Mora aqui, e não num arquivo novo.** Este é o módulo do *como este status se parece*: o
 * `FORMA_DO_SELO` já responde isso para o selo, e um segundo arquivo com o mesmo assunto seria a segunda
 * cópia que ele existe para impedir. O `SeloDeStatus` não muda; ganha um vizinho.
 *
 * **As três formas do marcador são as três formas do selo** (guia §2) — sólido, contorno, apagado —, e não
 * uma quarta escala inventada. O marcador e o selo do mesmo registro dizem a mesma coisa com a mesma
 * tinta, lidos juntos.
 *
 * **`Pausada` leva borda tracejada**, que é o mesmo sinal que a `ReguaDoCiclo` dá à saída do ciclo
 * (`regua-do-ciclo.tsx:74-77`): o que está fora da linha tem contorno interrompido, nas duas telas.
 *
 * **O ícone é a TERCEIRA pista, nunca a primeira** (compromisso A-5): a palavra está no selo, a forma está
 * no marcador, e o ícone é `aria-hidden`. Repetir o nome do status num `aria-label` faria o leitor de tela
 * dizer *Em análise* duas vezes por registro.
 *
 * **`status` é `string` pela ADR-0006**, como no `FORMA_DO_SELO`, e desconhecido cai no contorno. O custo
 * — perder a exaustividade do `tsc` — é o mesmo, e a guarda de `formulario.test.ts` é o que o cobre.
 */
const ICONE_DO_STATUS: Readonly<Record<string, typeof FilePlus>> = {
  aberta: FilePlus,
  em_analise: Search,
  em_atendimento: Wrench,
  pausada: Pause,
  resolvida: Check,
  cancelada: Ban,
};

const FORMA_DO_MARCADOR: Readonly<Record<string, string>> = {
  aberta: "bg-accent text-accent-foreground border-transparent",
  em_analise: "border-linha text-tinta bg-superficie",
  em_atendimento: "border-linha text-tinta bg-superficie",
  pausada: "bg-accent text-accent-foreground border-dashed border-tinta-suave",
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

/**
 * O marcador de um registro no trilho de T-06 — 26 px, redondo, com o ícone do status dentro.
 *
 * **Ele é `aria-hidden` inteiro**, pelo mesmo argumento da `ReguaDoCiclo`: *"é o desenho da relação que a
 * ordem do `<ol>` já publica"*. Quem lê por leitor de tela recebe o selo, que tem a palavra.
 *
 * **`shrink-0` não é enfeite:** sem ele, um nome de autor longo espreme o círculo num oval.
 */
export function MarcadorDoStatus({ status }: { status: string }) {
  const Icone = ICONE_DO_STATUS[status] ?? Search;

  return (
    <span
      aria-hidden="true"
      className={`relative z-10 flex size-[26px] shrink-0 items-center justify-center rounded-full border ${FORMA_DO_MARCADOR[status] ?? "border-linha text-tinta bg-superficie"}`}
    >
      <Icone className="size-3.5" />
    </span>
  );
}
