"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

import { gruposDoCodigo } from "@/interface/componentes/grupos-do-codigo";
import { Button } from "@/interface/componentes/ui/button";

/**
 * **O código da organização em T-15: o `M1` e o `M2` do item 46 · 47, na forma do item 44i.**
 *
 * **O achado `V-01` era este:** o `codigoPublico` chega ao cliente em toda sessão desde o item 7b e
 * **nenhum JSX o renderizava**. O inventário chama esse código de *"o do cartaz do elevador"*, e cartaz
 * exige que alguém consiga lê-lo para escrevê-lo ali.
 *
 * **Dois grupos de quatro, em mono, no papel de título de página** (critério 44i.3): ele é para ser lido
 * do outro lado da mesa por quem vai transcrevê-lo. A prancheta desenha 28 px, e o critério 44i.9 manda
 * usar só os sete papéis; o mais próximo é o de 26 px. O alfabeto do sorteio já tira `I`, `O`, `0` e `1`
 * porque a transcrição humana erra; copiar é o conserto do mesmo problema um nível acima.
 *
 * **O espaço entre os grupos é margem, e não caractere.** Os grupos são texto em linha, sem espaço no
 * documento, então selecionar à mão e copiar pelo botão dão o mesmo código. Em linha, e não como itens de
 * uma caixa flexível: item flexível vira bloco, e o navegador pode pôr uma quebra de linha entre dois
 * blocos ao copiar.
 *
 * **A falha tem nome, e é prevista.** `navigator.clipboard` **não existe fora de contexto seguro**, e a
 * aplicação servida em `http://host.docker.internal:3000` não é `localhost` nem `https`. Quando a API não
 * existe ou a escrita rejeita, o componente **seleciona o texto do código** e troca a frase de apoio.
 * **O botão nunca diz `Copiado` sem ter copiado.**
 *
 * **A palavra, nunca só um ícone** (compromisso A-5): o desfecho é `Copiado`, escrito, e anunciado pela
 * região `status` da frase de apoio. **Sem aviso flutuante**: copiar não é salvamento, e a palavra no
 * botão é a resposta.
 *
 * **Devolve os dois `dd` do item *Código da organização***; o `dt` é da página, que monta a lista de
 * definição. A região viva mora num parágrafo dentro do `dd`, porque o `dd` não aceita outro papel.
 */
export function CodigoDaOrganizacao({ codigo }: { codigo: string }) {
  const [desfecho, setDesfecho] = useState<"parado" | "copiado" | "selecione">("parado");
  const valor = useRef<HTMLSpanElement>(null);

  function selecionar() {
    const no = valor.current;
    if (no === null) return;
    const intervalo = document.createRange();
    intervalo.selectNodeContents(no);
    const selecao = window.getSelection();
    selecao?.removeAllRanges();
    selecao?.addRange(intervalo);
  }

  async function copiar() {
    try {
      // `navigator.clipboard` é `undefined` fora de contexto seguro — a checagem vem antes do `await`.
      if (navigator.clipboard === undefined) throw new Error("sem área de transferência");
      await navigator.clipboard.writeText(codigo);
      setDesfecho("copiado");
      window.setTimeout(() => setDesfecho("parado"), 4000);
    } catch {
      setDesfecho("selecione");
      selecionar();
    }
  }

  return (
    <>
      <dd className="flex flex-wrap items-center gap-3">
        <span
          ref={valor}
          className="border-linha bg-background text-tinta text-titulo-pagina inline-block rounded-md border px-4 py-1.5 font-mono leading-snug font-medium tracking-[0.08em] tabular-nums select-all"
        >
          {gruposDoCodigo(codigo).map((grupo, indice) => (
            <span key={indice} className={indice === 0 ? undefined : "ml-3.5"}>
              {grupo}
            </span>
          ))}
        </span>
        <Button
          type="button"
          variant="outline"
          className="border-linha text-interface min-h-11 rounded-sm px-4 has-[>svg]:px-4"
          onClick={() => void copiar()}
        >
          {desfecho === "copiado" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {desfecho === "copiado" ? "Copiado" : "Copiar"}
        </Button>
      </dd>
      <dd>
        <p role="status" aria-live="polite" className="text-meta text-tinta-suave max-w-115">
          {desfecho === "selecione"
            ? "Selecione o código e copie."
            : "É o código do cartaz do elevador. Quem o digita abre um pedido de entrada, que você decide em Participantes. Ele não muda."}
        </p>
      </dd>
    </>
  );
}
