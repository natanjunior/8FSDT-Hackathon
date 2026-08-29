"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { Button } from "@/interface/componentes/ui/button";

/**
 * ============================================================================
 *  O bloco de T-05 que NÃO é modal — e é o único assim
 * ============================================================================
 *
 * Os cinco comandos com formulário abrem modal; este mora **no corpo da tela**, e a decisão é do
 * inventário, não deste componente: *"Registrar solução aplicada · **campo no corpo da tela**, não modal"*
 * (`inventario-de-telas.md`). O protótipo desenha o bloco entre a descrição e a linha do tempo, com
 * rótulo, `textarea` de 4.000 e um *Salvar* discreto (`telas.html`).
 *
 * **Por que não vira o `useComandoDeModal` que a spec do item 26 esboçou.** O ciclo dos cinco modais tem
 * `aberto`, `precisaRepintar` e repinte **no fechamento** — porque repintar no erro desmontaria o modal no
 * exato caso em que a frase do `409` existe para ser lida (furo F-2 do item 19). **Aqui nada desmonta:** o
 * bloco fica na tela, então o repinte acontece no sucesso e a frase de erro sobrevive sozinha. A extração
 * continua sendo dos cinco modais; este não é o sexto caso.
 *
 * **O repinte NÃO remonta este componente, e é isso que faz o botão apagar.** `router.refresh()`
 * re-renderiza a página do servidor e a prop `valorAtual` chega com o texto novo; o estado `texto`
 * permanece, porque o componente não é desmontado. Como `podeSalvar` compara os dois, ele fica `false` —
 * sem uma linha a mais.
 *
 * **O aviso de visibilidade NÃO está aqui**, e é a letra da restrição herdada nº 1 do inventário: ela
 * enumera *"todo modal que tem campo `observacao`"*, e isto não é modal nem `observacao`. Que este campo
 * também é lido pelo Solicitante e também congela em `resolvida` é verdade e **não tem texto em documento
 * nenhum** — é o achado **A-2** da spec, e inventar a frase aqui seria escrever texto de produto num
 * componente.
 *
 * **Acessibilidade:** `<label htmlFor>` de verdade (**A-1**) — `placeholder` **não** é rótulo —,
 * `min-h-11` no campo e `h-11` no botão (**A-3**), e o erro e a confirmação em **palavra**, com
 * `role="alert"` e `role="status"` (**A-5**). O DOM é linear, então a ordem de foco é a de leitura (A-2).
 */
export function CampoDeSolucaoAplicada({
  ocorrenciaId,
  valorAtual,
  rotulosDeStatus,
}: {
  ocorrenciaId: string;
  /** O que está gravado. **O campo abre pré-preenchido**, e não vazio: é registro, não rascunho. */
  valorAtual: string | null;
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const campoId = useId();
  const [texto, setTexto] = useState(valorAtual ?? "");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  /**
   * **Vazio desabilita porque o schema o proíbe** (`minLength: 1`, `required`): habilitar produziria um
   * `400` no clique, sobre um campo que a pessoa vê vazio. **Igual desabilita porque não há o que salvar.**
   *
   * **No `ModalDeResolucao` o *Resolver* continua sem desabilitar, e não é incoerência:** lá os dois campos
   * são opcionais e *"a indução é o foco, nunca a trava"*. São dois contratos diferentes para o mesmo dado,
   * e a diferença está publicada — `required: false` num, `required: [solucaoAplicada]` no outro.
   */
  const podeSalvar = !enviando && texto.trim() !== "" && texto !== (valorAtual ?? "");

  async function salvar() {
    setEnviando(true);
    setAviso(null);
    setSalvo(false);

    // **A tela manda o que digitou, sem aparar.** Quem apara é o schema, num lugar só — e `podeSalvar` já
    // impede o envio de espaço em branco, então nada chega vazio ao `400`.
    const resultado = await executarComando(
      ocorrenciaId,
      "registrar-solucao-aplicada",
      { solucaoAplicada: texto },
      rotulosDeStatus,
    );

    setEnviando(false);

    if (resultado.ok) {
      setSalvo(true);
      // **O repinte acontece no sucesso**, e não no fechamento: não há fechamento. Ele traz `valorAtual`
      // novo, e é o que apaga o botão.
      router.refresh();
      return;
    }

    setAviso(resultado.aviso);
  }

  return (
    <section className="flex flex-col gap-2">
      <label htmlFor={campoId} className="text-tinta text-sm font-semibold">
        Solução aplicada
      </label>

      <textarea
        id={campoId}
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          // Aviso velho ao lado de texto novo é a pior combinação possível — e a confirmação some junto,
          // porque ela fala de um texto que já não é o que está na tela.
          setAviso(null);
          setSalvo(false);
        }}
        disabled={enviando}
        rows={4}
        /* **O mesmo teto do schema** — 4000. Dois números divergiriam. */
        maxLength={4000}
        placeholder="O que foi feito"
        className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 py-2 text-base"
      />

      {aviso !== null && (
        <p
          role="alert"
          className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
        >
          {aviso}
        </p>
      )}

      {/* **A única frase nova de produto desta fatia**, declarada no achado A-3 da spec para o hub
          confirmar ou trocar. Sem ela o sucesso é invisível: o repinte devolve o mesmo texto no mesmo
          campo, e a única mudança perceptível seria o botão apagando — que é ausência, não confirmação. */}
      {salvo && aviso === null && (
        <p role="status" className="text-tinta-suave text-xs">
          Solução aplicada salva.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-auto self-start"
        disabled={!podeSalvar}
        onClick={() => void salvar()}
      >
        {enviando ? "Salvando…" : "Salvar"}
      </Button>
    </section>
  );
}
