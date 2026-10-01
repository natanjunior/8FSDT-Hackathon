"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { IndicadorDeEnvio } from "@/interface/componentes/campo";
import type { VinculoNoMenu } from "@/interface/componentes/lista-de-organizacoes";
import { avisarErro } from "@/interface/componentes/retorno-de-acao";
import { trocarOrganizacao } from "@/interface/componentes/troca-de-organizacao";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/interface/componentes/ui/select";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * **A troca de organização na barra superior.**
 *
 * Ela era `dropdown-menu` e passa a ser `select` (critério 44b.4): trocar de organização é escolher entre
 * valores mutuamente exclusivos com um atual, que é o que um `select` diz ao leitor de tela e um menu não.
 *
 * **Depois da troca o destino é `/`**, o losango, que reresolve o contexto e despacha. `replace` e não
 * `push`, porque voltar levaria a uma tela da organização anterior mostrando dados de outra. O `refresh`
 * antes dele evita que o cache do App Router sirva `/` com o contexto velho.
 *
 * **O recibo** (item 103, critério 3). A recusa diz a frase que `troca-de-organizacao.ts` já escreve, num
 * aviso flutuante: a barra não tem formulário nem linha de aviso, e uma faixa nova embaixo dela empurraria
 * a tela inteira. Durante o voo — o `PUT` e depois a navegação —, o gatilho mostra o indicador no lugar da
 * seta e não abre. **Sem `disabled`**: o `Select` devolve o foco ao gatilho ao fechar, e um gatilho
 * desabilitado o soltaria no corpo do documento.
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
  const [navegando, comecar] = useTransition();
  const [aberto, definirAberto] = useState(false);
  const emVoo = trocando || navegando;

  async function escolher(organizacaoId: string) {
    if (emVoo || organizacaoId === organizacaoAtivaId) return;
    definirTrocando(true);

    const resultado = await trocarOrganizacao(organizacaoId);
    if (!resultado.ok) {
      definirTrocando(false);
      avisarErro(resultado.aviso);
      return;
    }

    // A transição liga antes de o `PUT` desligar, e as duas atualizações saem juntas: o indicador não pisca
    // entre a resposta e a navegação.
    comecar(() => {
      router.refresh();
      router.replace("/");
    });
    definirTrocando(false);
  }

  return (
    <Select
      value={organizacaoAtivaId}
      open={aberto && !emVoo}
      onOpenChange={(proximo) => definirAberto(proximo && !emVoo)}
      onValueChange={(valor) => void escolher(valor)}
    >
      <SelectTrigger
        aria-label="Organização"
        aria-busy={emVoo}
        aria-disabled={emVoo}
        // Durante o voo a seta do catálogo — o último `svg` do gatilho — dá lugar ao indicador.
        className={cn("min-h-11 max-w-[14rem] border-0 shadow-none", emVoo && "[&>svg:last-child]:hidden")}
      >
        <SelectValue />
        <IndicadorDeEnvio ativo={emVoo} />
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
