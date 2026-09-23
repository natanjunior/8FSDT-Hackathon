"use client";

import { Eye, EyeClosed } from "lucide-react";
import { useState } from "react";

import type { PropsDoControle } from "@/interface/componentes/campo";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **O campo de senha com o botão que mostra e oculta** — critério 44m.4, decidido pelo dono em
 * 20/09/2026. Entra em T-01, T-11 e T-13; T-12 não tem campo de senha.
 *
 * **O estado inicial é oculto**, e a alternância troca o `type` em vez de esconder por CSS: é o que faz
 * o gerenciador de senhas continuar reconhecendo o campo enquanto ele está oculto.
 *
 * **O rótulo alterna e nomeia a senha** — *"Mostrar a senha"* / *"Ocultar a senha"*. Isso colide com o
 * `getByLabel("Senha")` do teste de ponta a ponta, que casa por trecho e alcança qualquer elemento com
 * `aria-label`; o conserto está do outro lado, na linha 341 do teste, que passou a usar uma expressão
 * ancorada. **Quem mexer neste rótulo tem de olhar aquela linha.**
 *
 * **Sem dica na passagem do ponteiro.** A regra de dica do guia §7 é das *ações de linha*; dentro de um
 * campo ela apareceria a cada foco sem trazer informação nova.
 *
 * **O botão é o `Button` do catálogo**, e não um elemento `button` cru: o G7 do guia conta controle cru
 * fora de `componentes/ui/`, e as quatro telas de conta estão em zero. *(A frase não escreve a etiqueta
 * com os sinais de menor e maior de propósito — a guarda do critério 44m.4 lê o texto-fonte, e o
 * exemplo dentro do comentário contaria como ocorrência.)*
 */
export function EntradaDeSenha({
  controle,
  name,
  autoComplete,
}: {
  controle: PropsDoControle;
  name: string;
  autoComplete: "current-password" | "new-password";
}) {
  const [visivel, definirVisivel] = useState(false);

  return (
    <div className="relative">
      <Input
        {...controle}
        name={name}
        type={visivel ? "text" : "password"}
        autoComplete={autoComplete}
        required
        className="border-linha bg-background min-h-11 pr-12"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={visivel ? "Ocultar a senha" : "Mostrar a senha"}
        onClick={() => {
          definirVisivel(!visivel);
        }}
        className="text-tinta-suave hover:text-tinta absolute inset-y-0 right-0 rounded-l-none"
      >
        {visivel ? <EyeClosed aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}
