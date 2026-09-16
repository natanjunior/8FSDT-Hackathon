"use client";

import { useRef, useState } from "react";

import { Button } from "@/interface/componentes/ui/button";

/**
 * **O código da organização em T-15 — o `M1` e o `M2` do item 46 · 47.**
 *
 * **O achado `V-01` era este:** o `codigoPublico` chega ao cliente em toda sessão desde o item 7b e
 * **nenhum JSX o renderizava**. O inventário chama esse código de *"o do cartaz do elevador"*, e cartaz
 * exige que alguém consiga lê-lo para escrevê-lo ali.
 *
 * **Fonte mono, selecionável e no tamanho do título da seção:** ele é para ser lido do outro lado da
 * mesa por quem vai transcrevê-lo. O alfabeto do sorteio já tira `I`, `O`, `0` e `1` porque a transcrição
 * humana erra; copiar é o conserto do mesmo problema um nível acima.
 *
 * **A falha tem nome, e é prevista.** `navigator.clipboard` **não existe fora de contexto seguro**, e o
 * roteiro de validação usa `http://host.docker.internal:3000`, que não é `localhost` nem `https`. Quando
 * a API não existe ou a escrita rejeita, o componente **seleciona o texto do código** e troca a frase de
 * apoio. **O botão nunca diz `Copiado` sem ter copiado.**
 *
 * **A palavra, nunca só um ícone** (compromisso A-5): o desfecho é `Copiado`, escrito, e anunciado por
 * `aria-live`.
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
    <div className="flex flex-col gap-1.5">
      <p className="text-tinta text-sm font-medium">Código da organização</p>

      <div className="flex flex-wrap items-center gap-3">
        <span ref={valor} className="text-tinta font-mono text-xl tracking-widest select-all">
          {codigo}
        </span>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void copiar()}>
          {desfecho === "copiado" ? "Copiado" : "Copiar"}
        </Button>
      </div>

      <p role="status" aria-live="polite" className="text-tinta-suave text-sm leading-relaxed">
        {desfecho === "selecione"
          ? "Selecione o código e copie."
          : "É o código do cartaz do elevador. Quem o digita abre um pedido de entrada, que você decide em Participantes. Ele não muda."}
      </p>
    </div>
  );
}
