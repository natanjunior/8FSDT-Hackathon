"use client";

import { Check, Copy } from "lucide-react";

import { ExibicaoDeCodigo } from "@/interface/componentes/campo-de-codigo";
import { Button } from "@/interface/componentes/ui/button";
import { useCopiar } from "@/interface/ganchos/use-copiar";

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
 * **Desde o item 65 o código é desenhado nas casas do campo de código, desabilitadas** (critério 65.3):
 * não se edita, não recebe foco e não se seleciona por acidente. É a mesma peça que T-02 usa para digitar,
 * vista do outro lado.
 *
 * **A falha tem nome, e é prevista.** `navigator.clipboard` **não existe fora de contexto seguro**, e a
 * aplicação servida em `http://host.docker.internal:3000` não é `localhost` nem `https`. Quando a API não
 * existe ou a escrita rejeita, a frase de apoio passa a mostrar o código em texto, já selecionado para
 * `Ctrl+C`. É o mesmo mecanismo do `contato-por-icone.tsx`, sobre um texto que só existe na falha
 * (respostas do 65, P1). **O botão nunca diz `Copiado` sem ter copiado.**
 *
 * **A palavra, nunca só um ícone** (compromisso A-5): o desfecho é `Copiado`, escrito, e anunciado pela
 * região `status` da frase de apoio. **Sem aviso flutuante**: copiar não é salvamento, e a palavra no
 * botão é a resposta.
 *
 * **Devolve os dois `dd` do item *Código da organização***; o `dt` é da página, que monta a lista de
 * definição. A região viva mora num parágrafo dentro do `dd`, porque o `dd` não aceita outro papel.
 *
 * O mecanismo de copiar mora em `use-copiar.ts` desde o item 86.
 */
export function CodigoDaOrganizacao({ codigo }: { codigo: string }) {
  const { desfecho, copiar, copiaManual } = useCopiar(codigo);

  return (
    <>
      <dd className="flex flex-wrap items-center gap-3">
        <ExibicaoDeCodigo codigo={codigo} rotulo="Código da organização" />
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
          {desfecho === "selecione" ? (
            <>
              Selecione e copie:{" "}
              <span ref={copiaManual} className="text-tinta font-mono select-all">
                {codigo}
              </span>
            </>
          ) : (
            "Quem digita este código pede para entrar, e você decide em Participantes. Ele não muda."
          )}
        </p>
      </dd>
    </>
  );
}
