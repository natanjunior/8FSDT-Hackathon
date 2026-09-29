"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Aviso } from "@/interface/componentes/campo";
import { rotuloDoPapel } from "@/interface/componentes/frases-de-participantes";
import {
  LinhaDeOrganizacao,
  ListaDeOrganizacoes,
  type VinculoNoMenu,
} from "@/interface/componentes/lista-de-organizacoes";
import { trocarOrganizacao } from "@/interface/componentes/troca-de-organizacao";
import { Button } from "@/interface/componentes/ui/button";

/**
 * ============================================================================
 *  Escolher a organização — a lista da face D de T-02 e a de T-10
 * ============================================================================
 *
 * **Ele não resolve contexto e não sabe em que página está**: recebe `vinculos` já projetados. É o que
 * faz o mesmo componente servir as duas telas.
 *
 * **Depois da troca, o destino é `/`**: `/` é o **losango**, não uma tela — ele reresolve o contexto e
 * despacha para T-03, ou fica em T-10 quando `permissoes` vem `[]`. É o único destino correto para os três
 * papéis, e o Encarregado é o que o prova, porque não tem T-03 nenhuma. `replace` e não `push`, porque
 * *"voltar"* levaria a uma tela da organização anterior mostrando dados de outra.
 *
 * **A forma é a da `lista-de-organizacoes.tsx`** (critério 44o.10), e a linha é o `Button` do catálogo
 * (critério 44o.15): até o 44o era um botão cru. A variante `ghost` dá o foco, a pressão e o estado
 * inerte; as classes daqui dão a forma de linha. **O anel de foco é interno**, porque a lista corta o que
 * vaza dos cantos (`overflow-hidden`) e o anel de fora sumiria na primeira e na última linha.
 *
 * **Este arquivo foi o menu de organização até o 44o**, e o menu saiu: T-10 era o último lugar que o
 * usava, e o critério 44o.9 trocou o seletor pela lista. O caminho para a face E que o menu carregava
 * **não saiu junto** — mora em T-10 e no menu de pessoa (critério 44o.14).
 *
 * **Acessibilidade:** alvo de 44 px (A-3), o papel vem **em palavra** (A-5).
 */
export function EscolhaDeOrganizacao({
  vinculos,
  rotulo,
}: {
  vinculos: readonly VinculoNoMenu[];
  /** O rótulo da lista. A face D não tem — o título do cartão é a pergunta —; T-10 tem. */
  rotulo?: string;
}) {
  const { aviso, trocando, escolher } = useTroca();

  return (
    <>
      {aviso !== null && <Aviso>{aviso}</Aviso>}

      <ListaDeOrganizacoes rotulo={rotulo}>
        {vinculos.map((vinculo) => (
          <li key={vinculo.organizacaoId}>
            <Button
              type="button"
              variant="ghost"
              disabled={trocando}
              onClick={() => void escolher(vinculo.organizacaoId)}
              className="h-auto min-h-11 w-full justify-start rounded-none p-0 font-normal whitespace-normal focus-visible:-outline-offset-2"
            >
              <LinhaDeOrganizacao nome={vinculo.nome} apoio={rotuloDoPapel(vinculo.papel)} seta />
            </Button>
          </li>
        ))}
      </ListaDeOrganizacoes>
    </>
  );
}

/** O estado e a navegação da troca. */
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

  return { aviso, trocando, escolher };
}
