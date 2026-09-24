import { Ban, Check, FilePlus, Pause, Search, Wrench } from "lucide-react";

import { Badge } from "@/interface/componentes/ui/badge";

/**
 * **Seis tratamentos, um por estado** — critério 44q.10, que desfaz o 44p.21. A forma continua dizendo
 * se a ocorrência espera alguém (sólido: espera; contorno: andando; apagado: acabou); a cor separa os
 * dois estados de cada forma. *Aberta* veste a marca, e é a única exceção à regra *"a marca é da ação
 * principal"* do guia §2 — a prancheta a desenha assim, e o selo não é ação.
 *
 * *Cancelada* usa `--ink-soft`, e não o `--ink-faint` da prancheta: o fraco mede 2,57:1 sobre
 * `--sunken` no escuro, abaixo dos 4,5:1 de texto (desvio D1 do plano do 44q).
 *
 * **Desde o item 64 todo selo é cheio.** Com a prioridade em selo de contorno ao lado, o status precisava
 * ganhar peso para continuar sendo o primeiro a ser lido, e o dono escolheu preenchimento: o status é a
 * peça cheia da linha, e nenhuma outra é. *Em análise* e *Em atendimento* saíram do contorno para o
 * sólido, com tinta `--surface`, porque `--marca-foreground` sobre `--info` e `--ink-soft` mede 3:1 no
 * tema claro. A distinção entre os seis segue pela cor e, sempre, pela palavra.
 */
const FORMA_DO_SELO: Readonly<Record<string, string>> = {
  aberta: "bg-marca text-marca-foreground border-transparent",
  pausada: "bg-atencao text-marca-foreground border-transparent",
  em_analise: "bg-tinta-suave text-superficie border-transparent",
  em_atendimento: "bg-info text-superficie border-transparent",
  resolvida: "bg-muted text-ok border-transparent",
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
 * tinta, lidos juntos. Desde o item 64 o selo é todo cheio, e o marcador guarda as três formas: ele vive
 * sozinho no trilho, sem prioridade ao lado.
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
  aberta: "bg-marca text-marca-foreground border-transparent",
  em_analise: "border-tinta-suave text-tinta-suave bg-superficie",
  em_atendimento: "border-info text-info bg-superficie",
  pausada: "bg-atencao text-marca-foreground border-dashed border-tinta-suave",
  resolvida: "bg-muted text-ok border-transparent",
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
 * **Dentro de cada forma, uma cor por estado** (item 44q, critério 10), e o `FORMA_DO_SELO` acima diz
 * qual. Três cores entraram no tema para isso, `--ok`, `--atencao` e `--info`, e as medições de
 * contraste delas moram em `tema.test.ts`. *Aberta* veste a marca, que é a exceção do guia §2: o selo não
 * é ação, e a prancheta o desenha assim.
 *
 * **O raio, o tamanho e o peso vêm da peça:** o `ui/badge` passou a ter raio de 6 px e o oitavo papel da
 * escala (`text-rotulo-peca`), e nada aqui os repete — um `text-meta` no ponto de uso derrubaria o papel.
 *
 * **Nada é comunicado só por forma nem só por cor:** o selo sempre imprime o `statusRotulo`, que vem
 * pronto do servidor na coluna de quem lê (item 31).
 *
 * **`status` é `string` porque `app/` não importa o Domínio** (ADR-0006). Status desconhecido cai no
 * contorno neutro de *Em análise*.
 *
 * **E esse é o preço da regra.** `FORMA_DO_SELO` já foi `Record<StatusOcorrencia, string>`; trocar por
 * `Record<string, string>` custou a exaustividade do `tsc` — um sétimo status entraria em silêncio no
 * contorno em vez de falhar o build. É o custo declarado da ADR-0006, que mantém `app/` sem o Domínio.
 */
export function SeloDeStatus({ status, rotulo }: { status: string; rotulo: string }) {
  return (
    <Badge variant="outline" className={FORMA_DO_SELO[status] ?? FORMA_DO_SELO.em_analise}>
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
