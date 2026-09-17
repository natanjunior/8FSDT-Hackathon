"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";

/**
 * ============================================================================
 *  O seletor de prioridade — o primeiro controle de escrita fora da barra e
 *  fora do bloco de solução aplicada, e a PRIMEIRA ação desfazível do produto
 * ============================================================================
 *
 * **A forma é do inventário, não deste componente:** *"`alterar-prioridade` é um seletor, não um modal. Não
 * há texto a escrever, e a D6 já o congela em estado terminal — quando isso acontece, o seletor
 * simplesmente não está em `acoesDisponiveis`"* (`inventario-de-telas.md:811-812`). O protótipo o desenha
 * como primeira linha do bloco de identidade (`telas.html:2154-2158`).
 *
 * **`<select>` nativo**, como os cinco que o produto já tem. O `ctrl pick` do protótipo é estilo, e o
 * catálogo dele não foi adotado (item 13 da `fila-documentacao.md`).
 *
 * **Salva no `onChange` — critério 17.4, *"salvando na mudança"*.** Sem botão, sem modal, sem confirmar. E
 * é exatamente isso que cria a razão do desfazer, abaixo.
 *
 * ---------------------------------------------------------------------------
 *  A linha do desfazer — critério 17.7
 * ---------------------------------------------------------------------------
 *
 * **Este é o único ponto de escrita do produto sem confirmação:** os cinco comandos com formulário abrem
 * modal, e o campo de solução aplicada tem *Salvar* próprio. Num `<select>` nativo com foco, a seta do
 * teclado troca o valor e dispara `change` — sem intenção. **E o que foi sobrescrito não está em lugar
 * nenhum:** nem na trilha (critério 17.3), nem na linha do tempo (**PA-21**).
 *
 * Então a fatia entrega uma janela de conserto: depois de uma gravação bem-sucedida, uma linha sob o
 * seletor diz *"Prioridade alterada de Normal para Alta."* com um botão de texto **Desfazer**, que reenvia
 * o mesmo endpoint com o valor anterior. **As duas frases foram escritas pelo hub** (`respostas.md` P2),
 * não por este componente.
 *
 * **É NO BLOCO, e não no aviso flutuante.** O produto tem aviso flutuante para o retorno de ação desde o
 * item 44g, e o desfazer continua aqui pelo critério 17.7, que decidiu *"no bloco, não flutuante"*: a
 * novidade é a disponibilidade do desfazer, e ela precisa ficar ao lado do seletor. Levar o desfazer para
 * o aviso é decisão do hub (achado A-04 da spec do 44g).
 *
 * **Sem temporizador.** A linha sai por ação — troca, desfazer, erro, recarregar ou navegar.
 *
 * ---------------------------------------------------------------------------
 *  Os quatro estados, e por que são quatro
 * ---------------------------------------------------------------------------
 *
 * - **`escolhido`** — o sobrescrito otimista. `null` significa *"mostre o que o servidor mandou"*. É o que
 *   faz o controle exibir o valor novo **enquanto envia** e depois do sucesso, e o que **volta a `null` no
 *   erro**, devolvendo a tela ao valor que o banco tem.
 * - **`enviando`** — desabilita o `<select>` e o *Desfazer*.
 * - **`aviso`** — a frase do `executarComando`, em `role="alert"`.
 * - **`desfazer`** — o par `{ de, para }` da última gravação. **Um passo, nunca uma pilha:** uma pilha seria
 *   histórico, e histórico deste comando não existe (17.3).
 *
 * **Gravar e desfazer são a MESMA função**, com um booleano que diz se a linha nasce. O `onChange` chama
 * com `true`; o *Desfazer* chama com `false` — e isso **é** o *"não há desfazer do desfazer"* do critério,
 * escrito em um parâmetro em vez de num `if`.
 *
 * **O repinte não desmonta este componente** — é bloco de tela, não modal —, então `valorAtual` chega novo
 * e o estado local sobrevive. É o mecanismo descrito no cabeçalho de `campo-de-solucao-aplicada.tsx`.
 *
 * **O que isso expõe, declarado:** enquanto `escolhido` não é `null`, um repinte que traga `valorAtual`
 * **diferente** — outro Gestor mudou — fica mascarado até a próxima navegação. É a exposição que a **§7.9 do
 * contrato** aceita por escrito para este comando, com três razões. Não construímos defesa contra o que o
 * contrato decidiu aceitar.
 *
 * **Acessibilidade:** `<label htmlFor>` de verdade (**A-1**) — e **sem `<option>` vazia**, porque os três
 * valores são válidos e um deles está sempre gravado —, `min-h-11` no seletor e no botão (**A-3**), a
 * **palavra** sempre (**A-5**), `role="alert"` para o erro e `role="status"` no contêiner que traz a frase
 * **e** o botão — a novidade é a *disponibilidade* do desfazer, não só a frase. O DOM é linear, então a
 * ordem de foco é a de leitura (**A-2**).
 */
export function SeletorDePrioridade({
  ocorrenciaId,
  valorAtual,
  opcoes,
  rotulosDeStatus,
  organizacaoId,
}: {
  ocorrenciaId: string;
  /** O que está gravado. Chega novo a cada repinte do servidor. */
  valorAtual: string;
  /** Os três pares prontos, na ordem de `PRIORIDADES`. O navegador não monta rótulo. */
  opcoes: readonly { valor: string; rotulo: string }[];
  /** O mapa pronto, para a frase do `409` de transição que o `executarComando` monta. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
}) {
  const router = useRouter();
  const campoId = useId();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [desfazer, setDesfazer] = useState<{ de: string; para: string } | null>(null);

  const valor = escolhido ?? valorAtual;

  /** A palavra do valor, lida das opções que já desceram — nenhum mapa novo, nenhum tipo do Domínio. */
  const palavraDe = (prioridade: string): string =>
    opcoes.find((opcao) => opcao.valor === prioridade)?.rotulo ?? prioridade;

  /**
   * A gravação, e o desfazer é ela com `oferecerDesfazer: false`.
   *
   * **`anterior` é o que estava na tela imediatamente antes desta gravação** — é o que faz o *Desfazer*
   * voltar **um** passo, nunca ao valor original.
   */
  async function gravar(destino: string, anterior: string, oferecerDesfazer: boolean) {
    setEnviando(true);
    setAviso(null);
    // **O valor exibido é o escolhido, já.** Deixar o antigo na tela enquanto envia mostraria uma
    // prioridade que a pessoa acabou de trocar.
    setEscolhido(destino);

    const resultado = await executarComando(
      ocorrenciaId,
      "alterar-prioridade",
      { prioridade: destino },
      rotulosDeStatus,
      organizacaoId,
    );

    setEnviando(false);

    if (resultado.ok) {
      // **O repinte acontece no sucesso**, e não no fechamento: não há fechamento.
      setDesfazer(oferecerDesfazer ? { de: anterior, para: destino } : null);
      router.refresh();
      return;
    }

    // **No erro, a tela volta ao valor gravado** — deixá-la no valor recusado mostraria uma prioridade que
    // o banco não tem. **E a linha do desfazer sai:** ela oferecia voltar a um estado que já não é o caso.
    setEscolhido(null);
    setDesfazer(null);
    setAviso(resultado.aviso);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={campoId} className="text-tinta-suave text-sm font-medium">
          Prioridade
        </label>
        <select
          id={campoId}
          value={valor}
          disabled={enviando}
          onChange={(evento) => {
            void gravar(evento.target.value, valor, true);
          }}
          className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 text-base"
        >
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </div>

      {aviso !== null && (
        <p
          role="alert"
          className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
        >
          {aviso}
        </p>
      )}

      {/* **A janela de conserto — critério 17.7.** A frase e o botão no MESMO contêiner com `role="status"`:
          a novidade é a disponibilidade do desfazer, não só a frase. Sem temporizador: a linha sai por
          ação. */}
      {desfazer !== null && aviso === null && (
        <p role="status" className="text-tinta-suave flex flex-wrap items-center gap-2 text-xs">
          Prioridade alterada de {palavraDe(desfazer.de)} para {palavraDe(desfazer.para)}.
          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              void gravar(desfazer.de, desfazer.para, false);
            }}
            className="text-marca min-h-11 underline underline-offset-4"
          >
            Desfazer
          </button>
        </p>
      )}
    </div>
  );
}
