"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ICONE_PADRAO } from "@/dominio/organizacao";
import { SeletorDeIcone } from "@/interface/componentes/icone-de-categoria";
import { Campo } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { ICONES_DE_CATEGORIA, type NomeDeIcone } from "@/interface/schemas";

/**
 * **T-09 · o formulário de categoria**, nos dois modos.
 *
 * **`ordem` é campo daqui, e não seta na linha da lista** (spec §2.2). Setas exigiriam **duas** escritas
 * não atômicas, e `ordem` **não é única** no esquema: um empate deixa a seta morta — trocar valores
 * iguais não muda nada —, e desempatar custa renumerar a lista inteira. O contrato não tem endpoint de
 * lote.
 *
 * **Desativar passa por confirmação, e a segunda frase é a que quebra outra tela.** É o único ajuste
 * desta tela capaz de tornar T-04 insubmissível, e por isso o botão muda de texto.
 *
 * **O seletor de ícone é o item 4b, e está aqui.** Vinte e cinco células de 44 px; na criação a etiqueta
 * neutra já vem marcada, e na edição vem a que está salva. **Escolher ícone nunca é obrigatório** — o
 * servidor grava `tag` para quem não manda, e obrigar poria uma grade entre o Gestor e a edição de uma
 * palavra (modelo §14.5).
 */

export type ModoDeCategoria =
  | { tipo: "cadastro"; proximaOrdem: number }
  | {
      tipo: "edicao";
      categoriaId: string;
      nome: string;
      icone: string;
      ordem: number;
      ativa: boolean;
      /** Calculado pela página, que já tem a lista inteira — não é uma consulta a mais. */
      ehUltimaAtiva: boolean;
    };

const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  CATEGORIA_NOME_DUPLICADO: "Já existe uma categoria com este nome.",
  CATEGORIA_NAO_ENCONTRADA: "Esta categoria não existe mais.",
};

const MENSAGEM_GENERICA = "Não foi possível salvar agora. Tente de novo.";

export function FormularioDeCategoria({ modo }: { modo: ModoDeCategoria }) {
  const router = useRouter();
  const [nome, setNome] = useState(modo.tipo === "edicao" ? modo.nome : "");
  const [icone, setIcone] = useState<NomeDeIcone>(() => {
    if (modo.tipo !== "edicao") return ICONE_PADRAO;
    const salvo = ICONES_DE_CATEGORIA.find((i) => i.nome === modo.icone);
    return salvo?.nome ?? ICONE_PADRAO;
  });
  const [ordem, setOrdem] = useState(String(modo.tipo === "edicao" ? modo.ordem : modo.proximaOrdem));
  const [ativa, setAtiva] = useState(modo.tipo === "edicao" ? modo.ativa : true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmacao = useRef<HTMLDialogElement>(null);

  const ordemNumero = Number.parseInt(ordem, 10);
  const ordemVale = Number.isInteger(ordemNumero) && ordemNumero >= 0 && ordemNumero <= 999;
  const podeSalvar = nome.trim() !== "" && ordemVale;

  const estaDesativando = modo.tipo === "edicao" && modo.ativa && !ativa;

  async function salvar() {
    setEnviando(true);
    setErro(null);

    const alvo = modo.tipo === "cadastro" ? "/api/categorias" : `/api/categorias/${modo.categoriaId}`;
    const corpo =
      modo.tipo === "cadastro"
        ? { nome: nome.trim(), icone, ordem: ordemNumero }
        : { nome: nome.trim(), icone, ordem: ordemNumero, ativa };

    try {
      const resposta = await fetch(alvo, {
        method: modo.tipo === "cadastro" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        const problema = (await resposta.json().catch(() => ({}))) as { codigo?: string };
        setErro(TEXTO_DA_RECUSA[problema.codigo ?? ""] ?? MENSAGEM_GENERICA);
        setEnviando(false);
        return;
      }

      const chave = modo.tipo === "cadastro" ? "criada" : "alterada";
      router.replace(`/configuracao?${chave}=${encodeURIComponent(nome.trim())}&lista=categoria`);
      router.refresh();
    } catch {
      // `fetch` rejeitou antes de haver resposta — a rede caiu. Sem este `catch` a rejeição sobe pela
      // fronteira do React e a pessoa vê a tela de erro do framework no lugar de uma frase.
      setErro(MENSAGEM_GENERICA);
      setEnviando(false);
    }
  }

  return (
    <>
      <form
        className="flex max-w-md flex-col gap-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!podeSalvar || enviando) return;
          if (estaDesativando) confirmacao.current?.showModal();
          else void salvar();
        }}
      >
        <Campo id="nome" rotulo="Nome" ajuda="Até 60 caracteres." erro={erro ?? undefined}>
          <Input
            id="nome"
            value={nome}
            maxLength={60}
            required
            onChange={(evento) => setNome(evento.target.value)}
          />
        </Campo>

        <SeletorDeIcone valor={icone} aoEscolher={setIcone} />

        <Campo
          id="ordem"
          rotulo="Ordem"
          ajuda="Define em que posição a categoria aparece no formulário de registro. Menor vem antes; empate desempata pelo nome."
        >
          <Input
            id="ordem"
            type="number"
            min={0}
            max={999}
            step={1}
            value={ordem}
            onChange={(evento) => setOrdem(evento.target.value)}
          />
        </Campo>

        {modo.tipo === "edicao" && (
          <div className="flex items-start gap-2.5">
            <input
              id="ativa"
              type="checkbox"
              checked={ativa}
              className="border-input mt-1 size-4"
              onChange={(evento) => setAtiva(evento.target.checked)}
            />
            <label htmlFor="ativa" className="text-tinta text-sm leading-relaxed">
              Ativa — aparece no formulário de registro.
              <span className="text-tinta-suave block text-xs">
                Desativar não apaga: as ocorrências já registradas continuam apontando para esta
                categoria.
              </span>
            </label>
          </div>
        )}

        <Button type="submit" disabled={!podeSalvar || enviando} className="min-h-11">
          {enviando ? "Salvando…" : modo.tipo === "cadastro" ? "Criar categoria" : "Salvar"}
        </Button>
      </form>

      <dialog
        ref={confirmacao}
        className="border-linha bg-superficie text-tinta m-auto max-w-md rounded-md border p-5 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed">
            Desativar não apaga. As ocorrências já registradas continuam apontando para esta categoria, e
            ela deixa de aparecer no formulário de registro.
          </p>

          {modo.tipo === "edicao" && modo.ehUltimaAtiva && (
            /* **A única configuração desta tela que quebra outra tela** — peso maior, e o botão muda. */
            <p
              role="alert"
              className="border-marca/40 bg-accent rounded-md border px-3 py-2.5 text-sm font-medium"
            >
              Sem nenhuma categoria ativa, ninguém consegue registrar ocorrência.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => confirmacao.current?.close()}
            >
              Voltar
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={enviando}
              onClick={() => {
                confirmacao.current?.close();
                void salvar();
              }}
            >
              {modo.tipo === "edicao" && modo.ehUltimaAtiva ? "Desativar mesmo assim" : "Desativar"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
