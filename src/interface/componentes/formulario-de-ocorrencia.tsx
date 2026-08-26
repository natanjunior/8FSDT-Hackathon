"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconeDeCategoria } from "./icone-de-categoria";
import { Campo } from "./moldura-de-tela";

/**
 * ============================================================================
 *  T-04 — a ordem dos campos é a decisão, e ela vale segundos
 * ============================================================================
 *
 * **Título · descrição · categoria · bloco "Onde".** Os dois campos de texto são **consecutivos** e os
 * dois seletores vêm **depois**, e há três razões independentes para a mesma ordem
 * (`prototipo-low-fi.md` §2.3 e §2.5):
 *
 * 1. **Economia de teclado** — separar dois campos de digitação com um seletor custa duas trocas de
 *    teclado: ele descer, a tela reposicionar, e ele subir de novo.
 * 2. **Cobertura de cold start** — os dois únicos campos que dependem de rede são os dois últimos, então
 *    um cold start de até ~24 s é invisível ao Solicitante (RNF5 × RNF6).
 * 3. **Paralelismo do upload** — quando a foto entrar (13a), ela é o primeiro alvo, acima do título.
 *
 * **Área e Referência num bloco só, chamado "Onde".** Não é agrupamento estético: o glossário define
 * **Localização** como *"uma referência a uma Área mais um complemento em texto livre"*. Um conceito, um
 * bloco, um rótulo.
 *
 * **A descrição abre com duas linhas.** Ela aceita 5000 caracteres, e um campo alto **pede** um
 * parágrafo. É a única alavanca de desenho sobre o passo mais caro do orçamento — e ela é fraca.
 *
 * **O botão fica no fim do conteúdo, não fixo no rodapé.** Fixo, o teclado o cobre — e o teclado está
 * aberto durante a maior parte do registro.
 *
 * **Acessibilidade:** `Campo` exige `htmlFor` (A-1); os controles têm `min-h-11` ≈ 44 px (A-3); o erro é
 * texto com `role="alert"`, nunca cor sozinha (A-5).
 */

type CategoriaEscolhivel = { id: string; nome: string; icone: string };
type AreaEscolhivel = { id: string; nome: string; tipo: "comum" | "privativa" };

export function FormularioDeOcorrencia({
  categorias,
  areas,
}: {
  categorias: readonly CategoriaEscolhivel[];
  areas: readonly AreaEscolhivel[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);
  /** A categoria escolhida — so para o icone ao lado do seletor (criterio 11.6). */
  const [escolhida, setEscolhida] = useState("");

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    setFalha(null);

    const dados = new FormData(evento.currentTarget);
    const complemento = String(dados.get("localizacaoComplemento") ?? "").trim();

    try {
      const resposta = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titulo: String(dados.get("titulo") ?? ""),
          descricao: String(dados.get("descricao") ?? ""),
          categoriaId: String(dados.get("categoriaId") ?? ""),
          areaId: String(dados.get("areaId") ?? ""),
          localizacaoComplemento: complemento === "" ? null : complemento,
        }),
      });

      if (resposta.status === 201) {
        const criada = (await resposta.json()) as { id: string };
        /**
         * **Depois do `201`: T-05 da ocorrência criada, nunca de volta ao formulário** (critério 11.5).
         * É onde o primeiro registro da trilha está visível — e é a prova, para quem acabou de reclamar,
         * de que o pedido existe. `replace` e não `push`: o botão "voltar" do navegador não deve
         * reabrir um formulário já enviado.
         */
        router.replace(`/ocorrencias/${criada.id}`);
        return;
      }

      const problema = (await resposta.json()) as {
        detail?: string;
        codigo?: string;
        erros?: { campo: string; mensagem?: string }[];
      };

      if (problema.erros !== undefined && problema.erros.length > 0) {
        setErros(
          Object.fromEntries(
            problema.erros.map((erro) => [erro.campo, erro.mensagem ?? "Confira este campo."]),
          ),
        );
      }
      // O erro do campo vai **imediatamente abaixo dele** (achado P-02: com o teclado aberto sobra
      // metade da tela, e o campo em foco, o rótulo e o erro têm de caber juntos acima do teclado).
      // O que não é de campo vira a faixa acima do botão.
      if (problema.erros === undefined || problema.erros.length === 0) {
        setFalha(problema.detail ?? "Não foi possível registrar agora. Tente de novo.");
      }
    } catch {
      // `fetch` rejeitou antes de haver resposta — a rede caiu.
      setFalha("Sem conexão. O que você escreveu continua aqui; tente de novo quando a rede voltar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      <Campo id="titulo" rotulo="Título" erro={erros.titulo}>
        <input
          id="titulo"
          name="titulo"
          type="text"
          maxLength={150}
          required
          autoComplete="off"
          className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 text-base"
        />
      </Campo>

      <Campo
        id="descricao"
        rotulo="Descrição"
        ajuda="Uma ou duas frases bastam."
        erro={erros.descricao}
      >
        <textarea
          id="descricao"
          name="descricao"
          rows={2}
          maxLength={5000}
          required
          className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 py-2 text-base"
        />
      </Campo>

      <Campo id="categoriaId" rotulo="Categoria" erro={erros.categoriaId}>
        {/*
          **O ícone ao lado do nome, nunca no lugar dele** — critério 11.6 e compromisso A-5. O `select`
          nativo não renderiza componente dentro de `option`, então o ícone da categoria escolhida
          aparece **ao lado do seletor**, e a lista mantém o nome, que é o dado.
        */}
        <div className="flex items-center gap-2">
          <select
            id="categoriaId"
            name="categoriaId"
            required
            defaultValue=""
            onChange={(evento) => setEscolhida(evento.target.value)}
            className="border-linha bg-superficie text-tinta min-h-11 flex-1 rounded-md border px-3 text-base"
          >
            <option value="" disabled>
              Escolha
            </option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
          <IconeDeCategoria
            nome={categorias.find((c) => c.id === escolhida)?.icone ?? "tag"}
            className="text-tinta-suave size-5 shrink-0"
          />
        </div>
      </Campo>

      {/*
        **O bloco "Onde"** — Localização é *"uma referência a uma Área mais um complemento em texto
        livre"* (glossário, D10). Eram um conceito desenhado como dois campos soltos.
      */}
      <fieldset className="border-linha flex flex-col gap-4 rounded-md border px-3 py-3">
        <legend className="text-tinta px-1 text-sm font-medium">Onde</legend>

        <Campo id="areaId" rotulo="Área" erro={erros.areaId}>
          <select
            id="areaId"
            name="areaId"
            required
            defaultValue=""
            className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 text-base"
          >
            <option value="" disabled>
              Escolha
            </option>
            {/*
              **Só as ativas, na ordem de `ordem`** (critério 12.4) — a ordem vem do servidor e a tela
              não reordena. **O `tipo` aparece na linha do item** porque é o dado que decide a
              visibilidade da ocorrência, e o Solicitante não tem outro lugar para vê-lo — e não vai num
              *tooltip*, pela regra A-6.
            */}
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nome} · {area.tipo === "comum" ? "área comum" : "unidade privativa"}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          id="localizacaoComplemento"
          rotulo="Referência do lugar (opcional)"
          erro={erros.localizacaoComplemento}
        >
          <input
            id="localizacaoComplemento"
            name="localizacaoComplemento"
            type="text"
            maxLength={200}
            className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 text-base"
          />
        </Campo>
      </fieldset>

      {falha !== null && (
        <p
          role="alert"
          className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2.5 text-sm"
        >
          {falha}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="bg-marca min-h-11 rounded-md px-4 text-base font-semibold text-white disabled:opacity-60"
        >
          {enviando ? "Registrando…" : "Registrar ocorrência"}
        </button>
        {/*
          **Cancelar volta ao shell.** O inventário manda ir para T-03, que não existe até o item 14 —
          o destino vira uma linha lá. A confirmação só aparece se algo foi digitado.
        */}
        <button
          type="button"
          onClick={(evento) => {
            const formulario = evento.currentTarget.closest("form");
            const digitou =
              formulario !== null &&
              [...new FormData(formulario).values()].some((valor) => String(valor).trim() !== "");
            if (!digitou || confirm("Descartar o que você escreveu?")) router.push("/");
          }}
          className="text-marca min-h-11 text-sm underline underline-offset-4"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
