"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { VinculoNoMenu } from "@/interface/componentes/menu-de-organizacao";
import { trocarOrganizacao } from "@/interface/componentes/troca-de-organizacao";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/interface/componentes/ui/select";

/**
 * **A troca de organização na barra superior.**
 *
 * Ela era `dropdown-menu` e passa a ser `select` (critério 44b.4): trocar de organização é escolher entre
 * valores mutuamente exclusivos com um atual, que é o que um `select` diz ao leitor de tela e um menu não.
 *
 * **Depois da troca o destino é `/`**, o losango, que reresolve o contexto e despacha. `replace` e não
 * `push`, porque voltar levaria a uma tela da organização anterior mostrando dados de outra. O `refresh`
 * antes dele evita que o cache do App Router sirva `/` com o contexto velho.
 */
export function SeletorDeOrganizacao({
  vinculos,
  organizacaoAtivaId,
}: {
  vinculos: readonly VinculoNoMenu[];
  organizacaoAtivaId: string;
}) {
  const router = useRouter();
  const [trocando, definirTrocando] = useState(false);

  async function escolher(organizacaoId: string) {
    if (organizacaoId === organizacaoAtivaId) return;
    definirTrocando(true);

    const resultado = await trocarOrganizacao(organizacaoId);
    if (!resultado.ok) {
      definirTrocando(false);
      return;
    }

    router.refresh();
    router.replace("/");
  }

  return (
    <Select
      value={organizacaoAtivaId}
      disabled={trocando}
      onValueChange={(valor) => void escolher(valor)}
    >
      <SelectTrigger className="min-h-11 max-w-[14rem] border-0 shadow-none" aria-label="Organização">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {vinculos.map((vinculo) => (
          <SelectItem key={vinculo.organizacaoId} value={vinculo.organizacaoId} className="min-h-11">
            {vinculo.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
