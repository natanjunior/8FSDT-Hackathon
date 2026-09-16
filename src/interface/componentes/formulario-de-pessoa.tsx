"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Campo } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **O nome da própria Pessoa, editável — o item 49.**
 *
 * Até 16/09/2026 o nome digitado no cadastro era definitivo para quem já tinha entrado numa organização:
 * `PATCH /vinculos/{pessoaId}` recusa justamente quem tem conta, e não havia o outro lado. Quem escreveu
 * *"natan"* em vez do nome completo aparecia assim para sempre, em **todas** as organizações.
 *
 * **Sem `cabecalhosDeEscrita`, e a diferença é o ponto.** `PATCH /organizacoes` afirma a organização com
 * `X-Organizacao-Id`; aqui não haveria o que afirmar — renomear a si mesmo não é ato **dentro** de uma
 * organização, e o endpoint roda fora do escopo (contrato §4.4).
 *
 * **O `router.refresh()` importa mais aqui do que importou em T-15.** O `MenuDePessoa` imprime o nome
 * **e calcula as iniciais do avatar** a partir dele. Sem o `refresh`, quem acabou de trocar o nome fica
 * com as iniciais antigas no canto da tela — a moldura discordando do conteúdo, no lugar mais visível
 * da casca.
 */

const MENSAGEM_GENERICA = "Não foi possível salvar agora. Tente de novo.";

export function FormularioDePessoa({ nome: nomeSalvo }: { nome: string }) {
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
      const resposta = await fetch("/api/contexto/pessoa", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: aparado }),
      });

      if (!resposta.ok) {
        const problema = (await resposta.json().catch(() => ({}))) as { detail?: string };
        setErro(problema.detail ?? MENSAGEM_GENERICA);
        setEnviando(false);
        return;
      }

      router.replace(`/meus-dados?renomeado=${encodeURIComponent(aparado)}`);
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
        id="nome-da-pessoa"
        rotulo="Nome"
        ajuda="É como você aparece para os Gestores: na lista de participantes, nos seus pedidos de entrada e em cada transição que você já registrou — a trilha guarda quem agiu, e mostra o nome de agora. Vale em todas as organizações em que você está."
        erro={erro ?? undefined}
      >
        <Input
          id="nome-da-pessoa"
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
