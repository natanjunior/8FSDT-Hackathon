"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { Campo } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **T-09 · o formulário de área.**
 *
 * **Nenhum tipo vem marcado na criação, e o botão fica indisponível até que um seja escolhido.** É a D10
 * levada à tela — *"a visibilidade é derivação, não configuração"* —, e é literalmente o mecanismo do
 * **PA-25** que o item 8 já materializou para o papel: *não existe valor que se obtém por não escolher*.
 *
 * **Mudar o tipo produz a frase mais importante da tela**, e a contagem que a alimenta vem da resposta do
 * `PATCH` — `ocorrenciasComTipoAnterior`, *"um campo de resposta que só existe para produzir uma frase de
 * tela"*.
 */

type TipoDeArea = "comum" | "privativa";

export type ModoDeArea =
  | { tipo: "cadastro"; proximaOrdem: number }
  | {
      tipo: "edicao";
      areaId: string;
      nome: string;
      tipoAtual: TipoDeArea;
      ordem: number;
      ativa: boolean;
      ehUltimaAtiva: boolean;
    };

const OS_DOIS_TIPOS: ReadonlyArray<{ valor: TipoDeArea; rotulo: string; exemplo: string }> = [
  { valor: "comum", rotulo: "Área comum", exemplo: "garagem, hall, salão" },
  { valor: "privativa", rotulo: "Unidade privativa", exemplo: "apartamento, sala, loja" },
];

const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  AREA_NOME_DUPLICADO: "Já existe uma área com este nome.",
  AREA_NAO_ENCONTRADA: "Esta área não existe mais.",
};

const MENSAGEM_GENERICA = "Não foi possível salvar agora. Tente de novo.";

export function FormularioDeArea({
  modo,
  organizacaoId,
}: {
  modo: ModoDeArea;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(modo.tipo === "edicao" ? modo.nome : "");
  const [tipo, setTipo] = useState<TipoDeArea | null>(modo.tipo === "edicao" ? modo.tipoAtual : null);
  const [ordem, setOrdem] = useState(String(modo.tipo === "edicao" ? modo.ordem : modo.proximaOrdem));
  const [ativa, setAtiva] = useState(modo.tipo === "edicao" ? modo.ativa : true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmacao = useRef<HTMLDialogElement>(null);

  const ordemNumero = Number.parseInt(ordem, 10);
  const ordemVale = Number.isInteger(ordemNumero) && ordemNumero >= 0 && ordemNumero <= 999;
  const podeSalvar = nome.trim() !== "" && tipo !== null && ordemVale;

  const estaDesativando = modo.tipo === "edicao" && modo.ativa && !ativa;

  async function salvar() {
    if (tipo === null) return;

    setEnviando(true);
    setErro(null);

    const alvo = modo.tipo === "cadastro" ? "/api/areas" : `/api/areas/${modo.areaId}`;
    const corpo =
      modo.tipo === "cadastro"
        ? { nome: nome.trim(), tipo, ordem: ordemNumero }
        : { nome: nome.trim(), tipo, ordem: ordemNumero, ativa };

    try {
      const resposta = await fetch(alvo, {
        method: modo.tipo === "cadastro" ? "POST" : "PATCH",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        const problema = (await resposta.json().catch(() => ({}))) as {
          codigo?: string;
          detail?: string;
        };
        // **O `detail` antes do genérico** (item 7b): o texto que nós escrevemos ganha, porque é
        // redigido para a tela; o do servidor entra quando não temos texto próprio (contrato §6.1).
        // Sem esta linha, o `409 ORGANIZACAO_DIVERGENTE` — alcançável desde o critério 7b.6 — vira
        // *"Não foi possível salvar agora"*, que é a única frase que **não** diz o que aconteceu.
        setErro(TEXTO_DA_RECUSA[problema.codigo ?? ""] ?? problema.detail ?? MENSAGEM_GENERICA);
        setEnviando(false);
        return;
      }

      if (modo.tipo === "cadastro") {
        router.replace(`/configuracao?criada=${encodeURIComponent(nome.trim())}&lista=area`);
        router.refresh();
        return;
      }

      // **Só o `PATCH` devolve a contagem**, e ela só interessa quando o tipo mudou de verdade.
      const corrigida = (await resposta.json().catch(() => ({}))) as {
        ocorrenciasComTipoAnterior?: number;
      };
      const mudouOTipo = tipo !== modo.tipoAtual;

      const parametros = new URLSearchParams({
        alterada: nome.trim(),
        lista: "area",
        ...(mudouOTipo ? { tipo, mantem: String(corrigida.ocorrenciasComTipoAnterior ?? 0) } : {}),
      });

      router.replace(`/configuracao?${parametros.toString()}`);
      router.refresh();
    } catch {
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
        <Campo id="nome" rotulo="Nome" ajuda="Até 80 caracteres." erro={erro ?? undefined}>
          <Input
            id="nome"
            value={nome}
            maxLength={80}
            required
            onChange={(evento) => setNome(evento.target.value)}
          />
        </Campo>

        {/* Radio, e não `select`: os dois valores precisam da explicação ao lado, e ela **nunca** pode ser
            tooltip — compromisso A-6. Cada opção tem o próprio rótulo associado — A-1. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-tinta text-sm font-medium">Tipo</legend>
          <p className="text-tinta-suave text-xs leading-relaxed">
            O tipo decide quem enxerga as ocorrências registradas nesta área. Não há padrão: escolher é
            obrigatório.
          </p>
          {OS_DOIS_TIPOS.map((opcao) => (
            <div key={opcao.valor} className="flex items-start gap-2.5">
              <input
                id={`tipo-${opcao.valor}`}
                type="radio"
                name="tipo"
                value={opcao.valor}
                checked={tipo === opcao.valor}
                className="border-input mt-1 size-4"
                onChange={() => setTipo(opcao.valor)}
              />
              <label htmlFor={`tipo-${opcao.valor}`} className="text-tinta text-sm leading-relaxed">
                {opcao.rotulo}
                <span className="text-tinta-suave block text-xs">{opcao.exemplo}</span>
              </label>
            </div>
          ))}
        </fieldset>

        {modo.tipo === "edicao" && tipo !== null && tipo !== modo.tipoAtual && (
          <p
            role="status"
            className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm leading-relaxed"
          >
            Mudar o tipo vale de agora em diante — o passado não muda. As ocorrências já registradas
            mantêm o tipo que a área tinha quando foram criadas.
          </p>
        )}

        <Campo
          id="ordem"
          rotulo="Ordem"
          ajuda="Define em que posição a área aparece no formulário de registro. Menor vem antes; empate desempata pelo nome."
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
                Desativar não apaga: as ocorrências já registradas continuam apontando para esta área.
              </span>
            </label>
          </div>
        )}

        <Button type="submit" disabled={!podeSalvar || enviando} className="min-h-11">
          {enviando ? "Salvando…" : modo.tipo === "cadastro" ? "Criar área" : "Salvar"}
        </Button>
      </form>

      <dialog
        ref={confirmacao}
        className="border-linha bg-superficie text-tinta m-auto max-w-md rounded-md border p-5 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed">
            Desativar não apaga. As ocorrências já registradas continuam apontando para esta área, e ela
            deixa de aparecer no formulário de registro.
          </p>

          {modo.tipo === "edicao" && modo.ehUltimaAtiva && (
            <p
              role="alert"
              className="border-marca/40 bg-accent rounded-md border px-3 py-2.5 text-sm font-medium"
            >
              Sem nenhuma área ativa, ninguém consegue registrar ocorrência.
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
