"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Aviso } from "@/interface/componentes/campo";
import { trocarOrganizacao } from "@/interface/componentes/troca-de-organizacao";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/interface/componentes/ui/dropdown-menu";

/**
 * ============================================================================
 *  O menu de organização — o `▾` que faltava, e a lista da face D
 * ============================================================================
 *
 * **Ele não resolve contexto e não sabe em que página está**: recebe `vinculos` e a organização ativa já
 * projetados. É o que faz o mesmo componente servir T-03, a T-10 provisória e — pela `EscolhaDeOrganizacao`
 * logo abaixo — a face D de T-02, e é o que o deixa pronto para o dia em que existir um shell de verdade.
 *
 * **O menu aparece com um vínculo só** (spec §2.7), e esconder seria o erro que fecha a porta para quem
 * ela existe para servir: a Persona 1B **começa com um vínculo** — o segundo só nasce de um pedido de
 * entrada feito de dentro. Um menu que só aparecesse depois do segundo vínculo seria uma porta que só abre
 * para quem já entrou.
 *
 * **Depois da troca, o destino é `/`** (spec §2.2): `/` é o **losango**, não uma tela — ele reresolve o
 * contexto e despacha para T-03, ou fica na T-10 quando `permissoes` vem `[]`. É o único destino correto
 * para os três casos, e o Encarregado é o que o prova, porque não tem T-03 nenhuma. `replace` e não
 * `push`, porque *"voltar"* levaria a uma tela da organização anterior mostrando dados de outra.
 *
 * **Acessibilidade:** o gatilho tem `min-h-11` (44 px, A-3), o papel vem **em palavra** e a ativa é
 * marcada com a palavra *atual*, nunca só com um sinal gráfico (A-5).
 */
export type VinculoNoMenu = {
  organizacaoId: string;
  nome: string;
  papel: string;
};

export function MenuDeOrganizacao({
  vinculos,
  organizacaoAtivaId,
  nomeDaOrganizacaoAtiva,
}: {
  vinculos: readonly VinculoNoMenu[];
  organizacaoAtivaId: string;
  nomeDaOrganizacaoAtiva: string;
}) {
  const { aviso, trocando, escolher, router } = useTroca();

  const papelAtual = vinculos.find((v) => v.organizacaoId === organizacaoAtivaId)?.papel ?? null;
  const outras = vinculos.filter((v) => v.organizacaoId !== organizacaoAtivaId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={trocando}
          className="text-tinta-suave inline-flex min-h-11 items-center gap-1 text-sm"
        >
          {trocando ? "Trocando…" : nomeDaOrganizacaoAtiva}
          <span aria-hidden>▾</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled className="flex-col items-start gap-0">
            <span className="text-tinta font-medium">{nomeDaOrganizacaoAtiva}</span>
            <span className="text-tinta-suave text-xs">
              {papelAtual === null ? "atual" : `${rotuloDoPapel(papelAtual)} · atual`}
            </span>
          </DropdownMenuItem>

          {outras.map((vinculo) => (
            <DropdownMenuItem
              key={vinculo.organizacaoId}
              className="min-h-11 flex-col items-start gap-0"
              onSelect={() => void escolher(vinculo.organizacaoId)}
            >
              <span className="text-tinta font-medium">{vinculo.nome}</span>
              <span className="text-tinta-suave text-xs">{rotuloDoPapel(vinculo.papel)}</span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* **O `setTimeout(…, 0)` não é enfeite**, e o plano já o previa como a alternativa: `router.push`
              dentro do `onSelect` do Radix compete com o fechamento do menu e produz navegação engolida em
              parte dos navegadores. Adiar um tique deixa o menu fechar primeiro. A navegação dura
              (`window.location.assign`) resolveria igual, mas o lint do Next a recusa para destino interno —
              e este plano não admite `eslint-disable`. */}
          <DropdownMenuItem
            className="min-h-11"
            onSelect={() => {
              setTimeout(() => router.push("/organizacao?entrar-em-outra=true"), 0);
            }}
          >
            Entrar em outra organização
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {aviso !== null && <Aviso>{aviso}</Aviso>}
    </>
  );
}

/**
 * **Face D de T-02 · escolher a organização.** A mesma troca, sem menu: quem chega aqui **não tem**
 * organização ativa, então não há nome no cabeçalho para pendurar um `▾`.
 */
export function EscolhaDeOrganizacao({ vinculos }: { vinculos: readonly VinculoNoMenu[] }) {
  const { aviso, trocando, escolher } = useTroca();

  return (
    <>
      {aviso !== null && <Aviso>{aviso}</Aviso>}

      <ul className="border-linha divide-linha-suave bg-superficie divide-y overflow-hidden rounded-md border">
        {vinculos.map((vinculo) => (
          <li key={vinculo.organizacaoId}>
            <button
              type="button"
              disabled={trocando}
              onClick={() => void escolher(vinculo.organizacaoId)}
              className="flex min-h-11 w-full flex-col gap-0.5 px-4 py-3.5 text-left disabled:opacity-60"
            >
              <span className="text-tinta text-base leading-snug font-medium">{vinculo.nome}</span>
              {/* A-5: nada é comunicado só por cor — o papel sempre carrega a palavra. */}
              <span className="text-tinta-suave text-xs">{rotuloDoPapel(vinculo.papel)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** O estado e a navegação, escritos uma vez para os dois consumidores deste arquivo. */
function useTroca() {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  async function escolher(organizacaoId: string) {
    setTrocando(true);
    setAviso(null);

    const resultado = await trocarOrganizacao(organizacaoId);

    if (!resultado.ok) {
      setAviso(resultado.aviso);
      setTrocando(false);
      return;
    }

    // `refresh` antes de `replace`: sem ele o cache do App Router serviria `/` com o contexto anterior, e a
    // pessoa veria a organização velha por uma renderização.
    router.refresh();
    router.replace("/");
  }

  return { aviso, trocando, escolher, router };
}

/**
 * O papel em palavra.
 *
 * **É a terceira cópia deste mapa no repositório** — a outra é o `PAPEL_EM_PALAVRA` de
 * `app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx`; a de T-08 virou `frases-de-participantes.ts` no
 * item 44j —, e o comentário de lá já registrou
 * o achado: *"o lugar dos dois é um módulo, e isso é achado, não conserto"*. **Ela não é uma cópia nova:**
 * a de `app/organizacao/page.tsx` morre nesta mesma tarefa, quando a lista da face D vira este componente.
 */
function rotuloDoPapel(papel: string): string {
  if (papel === "gestor") return "Gestor";
  if (papel === "encarregado") return "Encarregado";
  return "Solicitante";
}
