"use client";

import { Check, Copy, Mail, Phone } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { rotuloDoContato } from "@/interface/componentes/frases-de-participantes";
import type { ContatoNaLinha } from "@/interface/componentes/linhas-de-participantes";
import { Button } from "@/interface/componentes/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/interface/componentes/ui/popover";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  O contato da linha, por ícone — item 68a
 * ============================================================================
 *
 * **Um ícone por tipo que a pessoa tem**, e não um por contato: `Phone`, `Mail`, os dois nessa ordem, ou o
 * traço. **Cada ícone é botão que abre `popover`**, e não texto com `hover-card`: em toque não há ponteiro,
 * e valor que só aparece no hover fica inalcançável no celular (correção de peça do endosso de design).
 *
 * **Copiar copia o que está escrito**: o telefone legível, não o E.164. O botão diz *Copiado* só depois de
 * copiar, e a região viva anuncia. **Se a área de transferência recusar** (`navigator.clipboard` não existe
 * fora de contexto seguro), o valor fica selecionado, para `Ctrl+C`, e nada mais aparece.
 *
 * **44 px de alvo em cada ícone**, e por isso os 6 px do design ficam entre os botões, não entre os ícones.
 */
export function ContatoPorIcone({
  nome,
  telefones,
  emails,
}: {
  nome: string;
  telefones: readonly ContatoNaLinha[];
  emails: readonly ContatoNaLinha[];
}) {
  if (telefones.length === 0 && emails.length === 0) return <span className="text-tinta-fraca">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {telefones.length > 0 && (
        <BotaoDeContato
          rotulo={rotuloDoContato("telefone", telefones.length, nome)}
          icone={<Phone aria-hidden="true" className="size-[15px]" />}
          contatos={telefones}
        />
      )}
      {emails.length > 0 && (
        <BotaoDeContato
          rotulo={rotuloDoContato("email", emails.length, nome)}
          icone={<Mail aria-hidden="true" className="size-[15px]" />}
          contatos={emails}
        />
      )}
    </span>
  );
}

function BotaoDeContato({
  rotulo,
  icone,
  contatos,
}: {
  rotulo: string;
  icone: ReactNode;
  contatos: readonly ContatoNaLinha[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={rotulo}
          className="text-tinta-suave hover:bg-sidebar-accent hover:text-tinta size-11 rounded-sm"
        >
          {icone}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={rotulo}
        className="bg-superficie border-linha flex w-80 flex-col gap-3 p-3.5"
      >
        {contatos.map((contato) => (
          <LinhaDoContato key={contato.chave} contato={contato} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function LinhaDoContato({ contato }: { contato: ContatoNaLinha }) {
  const [copiado, setCopiado] = useState(false);
  const valor = useRef<HTMLSpanElement>(null);

  async function copiar() {
    try {
      // `navigator.clipboard` é `undefined` fora de contexto seguro — a checagem vem antes do `await`.
      if (navigator.clipboard === undefined) throw new Error("sem área de transferência");
      await navigator.clipboard.writeText(contato.valor);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      if (valor.current !== null) window.getSelection()?.selectAllChildren(valor.current);
    }
  }

  const detalhes = [contato.finalidade, contato.whatsapp ? "WhatsApp" : null].filter(
    (parte): parte is string => parte !== null,
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span ref={valor} className="text-interface text-tinta font-mono break-all select-all">
          {contato.valor}
        </span>
        {detalhes.length > 0 && <span className="text-meta text-tinta-suave">{detalhes.join(" · ")}</span>}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => void copiar()}
        className={cn(
          "border-linha-suave text-interface text-tinta-suave min-h-11 shrink-0 rounded-sm px-3",
          copiado && "text-tinta",
        )}
      >
        {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copiado ? "Copiado" : "Copiar"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copiado ? "Copiado." : ""}
      </span>
    </div>
  );
}
