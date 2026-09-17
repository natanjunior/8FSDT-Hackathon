"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { Campo } from "@/interface/componentes/campo";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **O nome da organização, editável — a metade que corrige do item 46 · 47.**
 *
 * Até 16/09/2026 o nome escolhido no cadastro era definitivo: `/organizacoes` declarava `post` e nada
 * mais. **O custo era maior do que parece**, porque o nome não fica só na tela de quem errou: ele aparece
 * para quem pede entrada, no seletor de organização e no título do pedido pendente.
 *
 * **O `router.refresh()` não é enfeite aqui.** O `SeletorDeOrganizacao` da `BarraSuperior` é um `Select`
 * cujo `SelectValue` imprime o nome da organização ativa, e ele é renderizado em **toda** tela da casca,
 * com um vínculo ou com vários. Sem o `refresh`, a tela que acabou de renomear passa a discordar da
 * moldura que a contém.
 */

const MENSAGEM_GENERICA = "Não foi possível salvar agora. Tente de novo.";

export function FormularioDeOrganizacao({
  nome: nomeSalvo,
  organizacaoId,
}: {
  nome: string;
  /** A organização com que a página renderizou — a afirmação da §4.3 (critério 7b.6). */
  organizacaoId: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeSalvo);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aparado = nome.trim();
  const podeSalvar = aparado !== "" && aparado !== nomeSalvo;

  async function salvar() {
    setEnviando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/organizacoes", {
        method: "PATCH",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify({ nome: aparado }),
      });

      if (!resposta.ok) {
        const problema = (await resposta.json().catch(() => ({}))) as { detail?: string };
        // **O `detail` do servidor antes do genérico**: o `409 ORGANIZACAO_DIVERGENTE` tem texto próprio,
        // e o genérico é a única frase que não diz o que aconteceu.
        setErro(problema.detail ?? MENSAGEM_GENERICA);
        setEnviando(false);
        return;
      }

      router.replace(`/configuracao?renomeada=${encodeURIComponent(aparado)}`);
      router.refresh();
    } catch {
      // `fetch` rejeitou antes de haver resposta — a rede caiu. Sem este `catch` a rejeição sobe pela
      // fronteira do React e a pessoa vê a tela de erro do framework no lugar de uma frase.
      setErro(MENSAGEM_GENERICA);
      setEnviando(false);
    }
  }

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!podeSalvar || enviando) return;
        void salvar();
      }}
    >
      <Campo
        id="nome-da-organizacao"
        rotulo="Nome da organização"
        ajuda="É o nome que aparece para quem pede entrada, no seletor de organização e no título do pedido pendente."
        erro={erro ?? undefined}
      >
        <Input
          id="nome-da-organizacao"
          value={nome}
          maxLength={120}
          required
          onChange={(evento) => setNome(evento.target.value)}
        />
      </Campo>

      <Button type="submit" disabled={!podeSalvar || enviando} className="min-h-11 self-start">
        {enviando ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
