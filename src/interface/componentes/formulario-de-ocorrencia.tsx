"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { ControleDeFoto, type EstadoDoAnexo } from "./controle-de-foto";
import { IconeDeCategoria } from "./icone-de-categoria";
import { Campo } from "./campo";

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
 * 3. **Paralelismo do upload** — a foto é o primeiro alvo, acima do título, e o upload corre enquanto a
 *    pessoa digita. Entrou com o item 13a; a ordem de foco é
 *    `foto → titulo → descricao → categoria → area → complemento → registrar`, que é o orçamento da §2 do
 *    protótipo e o compromisso **A-2**.
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

/** Os textos são os que o `inventario-de-telas.md` §10 fixou. Nenhum foi inventado aqui. */
const ERRO_DO_ANEXO: Readonly<Record<string, string>> = {
  ANEXO_NAO_RECONHECIDO:
    "A foto não chegou ou a autorização expirou. Escolha a foto de novo — o resto do que você escreveu está aqui.",
  ANEXO_ACIMA_DO_LIMITE:
    "A foto ficou grande demais depois da compressão. Tente uma foto com menos detalhe.",
};

type CategoriaEscolhivel = { id: string; nome: string; icone: string };
type AreaEscolhivel = { id: string; nome: string; tipo: "comum" | "privativa" };

export function FormularioDeOcorrencia({
  categorias,
  areas,
  organizacaoId,
}: {
  categorias: readonly CategoriaEscolhivel[];
  areas: readonly AreaEscolhivel[];
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);
  /** A categoria escolhida — so para o icone ao lado do seletor (criterio 11.6). */
  const [escolhida, setEscolhida] = useState("");
  const [anexo, setAnexo] = useState<EstadoDoAnexo>({ nome: "vazio" });
  /** Trocar a chave **remonta** o controle: é como ele volta a *vazio* sem um método imperativo. */
  const [chaveDoControle, setChaveDoControle] = useState(0);
  /** O `409`: a ocorrência que **já** tem esta foto. Presente, ele substitui o formulário inteiro. */
  const [jaRegistrada, setJaRegistrada] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    setFalha(null);

    const dados = new FormData(evento.currentTarget);
    const complemento = String(dados.get("localizacaoComplemento") ?? "").trim();

    /**
     * **O envio espera o `PUT`.** Com o upload em voo, aguarda a promessa; pronto, usa a referência;
     * vazio ou falhou, manda sem anexo — que é desfecho legítimo.
     */
    const referencia =
      anexo.nome === "pronta"
        ? anexo.referencia
        : anexo.nome === "subindo"
          ? await anexo.conclusao
          : null;

    try {
      const resposta = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify({
          titulo: String(dados.get("titulo") ?? ""),
          descricao: String(dados.get("descricao") ?? ""),
          categoriaId: String(dados.get("categoriaId") ?? ""),
          areaId: String(dados.get("areaId") ?? ""),
          localizacaoComplemento: complemento === "" ? null : complemento,
          anexos: referencia === null ? null : [referencia],
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
        ocorrenciaId?: string;
        erros?: { campo: string; mensagem?: string }[];
      };

      /**
       * **O `409` substitui o formulário, e o critério 13b.3 é explícito sobre por quê:** ele diz que a
       * tela *"não oferece tentar de novo nem escolher outra foto"* — e um formulário que continua na
       * tela oferece as duas por construção, porque o botão está lá. Bloco terminal é a forma que torna o
       * critério verdadeiro em vez de prometido.
       *
       * **Mostrar, e não navegar sozinho.** O quadro da S-T7 do inventário diz *"navega para a
       * ocorrência"*; a tabela de erros do mesmo documento e o critério pedem o texto **mais** o botão.
       * Seguimos o critério — navegar sozinho faria o texto recém-escrito desaparecer sem explicação, num
       * caminho que a pessoa já vive como falha de rede. *(Achado A-2 da spec.)*
       */
      if (problema.codigo === "ANEXO_JA_REIVINDICADO" && typeof problema.ocorrenciaId === "string") {
        setJaRegistrada(problema.ocorrenciaId);
        return;
      }

      /**
       * Os dois `422` do anexo são **erro de campo**, e o campo é a foto. O controle volta a *vazio* pela
       * remontagem por `key`, e a pessoa escolhe outra foto **sem perder uma palavra do que escreveu** —
       * que é a meia frase que o inventário chama de *"o conteúdo"*.
       *
       * *(A `blob:` da prévia descartada só é liberada quando a aba fecha: o controle revoga ao trocar e
       * ao remover, não no `unmount`. Um objeto por `422`, e é achado do relatório, não desta linha.)*
       */
      if (problema.codigo !== undefined && problema.codigo in ERRO_DO_ANEXO) {
        setErros({ foto: ERRO_DO_ANEXO[problema.codigo]! });
        setAnexo({ nome: "vazio" });
        setChaveDoControle((numero) => numero + 1);
        return;
      }

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

  if (jaRegistrada !== null) {
    return (
      <section
        role="alert"
        className="border-linha bg-superficie flex flex-col gap-3 rounded-md border px-4 py-4"
      >
        <p className="text-tinta text-base leading-snug">
          Esta ocorrência já foi registrada — a foto que você anexou já está nela.
        </p>
        <Link
          href={`/ocorrencias/${jaRegistrada}`}
          className="bg-marca inline-flex min-h-11 items-center justify-center rounded-md px-4 text-base font-semibold text-white"
        >
          Ver a ocorrência
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      {/* **A foto é o primeiro alvo da tela** — protótipo §2.3 e desenho D-1. O item 11 deixou este
          lugar reservado de propósito, e o 13a o preenche sem reordenar mais nada. */}
      <ControleDeFoto
        key={chaveDoControle}
        aoMudar={setAnexo}
        erro={erros.foto}
        organizacaoId={organizacaoId}
      />

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
          **Cancelar volta a T-03**, que é o que o inventário manda (`:278`) e o que o item 11 deixou
          anotado: *"o destino vira uma linha no item 14"*. A confirmação só aparece se algo foi digitado.
        */}
        <button
          type="button"
          onClick={(evento) => {
            const formulario = evento.currentTarget.closest("form");
            const digitou =
              formulario !== null &&
              [...new FormData(formulario).values()].some((valor) => String(valor).trim() !== "");
            if (!digitou || confirm("Descartar o que você escreveu?")) router.push("/ocorrencias");
          }}
          className="text-marca min-h-11 text-sm underline underline-offset-4"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
