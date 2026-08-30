"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";

import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { Button } from "@/interface/componentes/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/interface/componentes/ui/dropdown-menu";

/**
 * ============================================================================
 *  A barra de ações de T-05 — e por que ela deixou de ser a única renderizadora
 * ============================================================================
 *
 * **Ela renderiza exatamente o que recebeu, e nada além.** A lista vem de `acoesDisponiveis`, derivada
 * pelo servidor a partir da máquina de estados — *"desabilitar exige a segunda cópia da máquina de
 * estados"* (`inventario-de-telas.md`), e é isso que este componente não faz.
 *
 * **`formularios` é a mudança do item 19.** `analisar` é botão nu; `atribuir-responsavel` precisa de um
 * modal, e os outros oito comandos precisam de modal, seletor ou campo. Em vez de a barra ganhar **um `if`
 * por comando** — oito ramos até o item 27 —, ela recebe, por comando, **ou o nó pronto ou nada**. Quem
 * monta o nó é a **página**, que é quem tem os candidatos e quem sabe qual ação é a primeira.
 *
 * **Nenhum tipo do Domínio entra aqui.** `comando` é `string`, o rótulo chega pronto, o nó chega pronto e
 * o mapa de status chega pronto.
 *
 * **Dois botões lado a lado, não um menu** (spec §3.9 do item 19). O protótipo previu *"um primário largo
 * e um Mais ações"* porque *"quatro rótulos legíveis não cabem em 390 px"* — **com dois, cabem**.
 *
 * **Corrigido no item 22, e a frase antiga apontava para o item errado:** ela dizia que o menu *"nasce no
 * primeiro item em que TRÊS botões renderizáveis coexistirem, que é o 22"*. Depois do 22 o máximo continua
 * sendo **dois** — `alterar-prioridade` é seletor, `registrar-solucao-aplicada` é campo, e `pausar`,
 * `resolver` e `cancelar` ainda não existem.
 *
 * **Três aconteceu no item 23**, e são dois estados: `em_analise` com responsável — `atribuir`,
 * `iniciar-atendimento`, `pausar` — e `em_atendimento` — `atribuir`, `pausar`, `resolver`. **A regra de
 * quando o menu aparece NÃO mora aqui** — mora em `acoesDaBarra`, em `rotulos.ts`, pela mesma razão que
 * `acaoPrimaria`: a página e a barra contando por conta própria seriam duas fontes para o mesmo fato.
 *
 * **Comando que vai para o menu PRECISA ter nó de formulário.** A barra não renderiza botão nu dentro
 * do `DropdownMenuContent`: filho que não é `menuitem` é ARIA inválida e o menu perde a navegação por
 * setas (A-2 e A-4). Os TRÊS que chegam ao menu — `atribuir-responsavel`, `pausar` e, desde o item 18,
 * `cancelar` — têm modal com a variante `"menu"`.
 *
 * ---------------------------------------------------------------------------
 *  Corrigido no item 18: o perigo que esta nota anunciava NÃO EXISTE
 * ---------------------------------------------------------------------------
 *
 * **A frase antiga dizia** que, com `cancelar` construído, `pausada` teria três renderizáveis e
 * `retomar` *"poderá cair em `emMenu`"* — produzindo um `<button>` com `DialogTrigger` como filho
 * direto de `role="menu"` —, e endereçava ao item 18 o dever de dar a variante `"menu"` ao
 * `ModalDeObservacao`. **Ela estava errada, e a prova é de duas linhas que já existiam quando ela foi
 * escrita:**
 *
 * ```
 * acaoPrimaria:  if (nomeada !== null && renderizaveis.includes(nomeada)) return nomeada;
 * acoesDaBarra:  emMenu: renderizaveis.filter((comando) => comando !== destaque)
 * ```
 *
 * **`emMenu` exclui o destaque POR CONSTRUÇÃO.** Um comando `X` só chega ao menu se é renderizável
 * **e** `X ≠ destaque`. `retomar` só é renderizável em `pausada` — é a única entrada dele em
 * `TRANSICOES` — e `ACAO_PRIMARIA.pausada === "retomar"`: sempre que ele é renderizável, ele **é** o
 * destaque, e o `filter` o remove.
 *
 * **O mesmo argumento vale para `analisar` (`aberta`), `iniciar-atendimento` (`em_analise`) e
 * `resolver` (`em_atendimento`)** — cada um é o `ACAO_PRIMARIA` do único estado em que é renderizável.
 * E vale para `avaliar` no item 27: `ACAO_PRIMARIA.resolvida === "avaliar"`.
 *
 * **Os três que chegam ao menu não são `ACAO_PRIMARIA` de estado nenhum**, e é exatamente por isso que
 * caem lá. **A coincidência virou invariante guardada:** um caso de `testes/interface/ocorrencia.test.ts`
 * percorre os seis status com as permissões do Gestor e assere que `emMenu` só contém comandos que têm
 * a variante `"menu"`. No dia em que alguém mexer em `ACAO_PRIMARIA`, ele cai — que é o alarme que esta
 * nota queria ser.
 *
 * **A geometria é a do protótipo desde o item 22** (`docs/prototipo/telas.html:328-330`): o primário
 * cresce (`flex-1`), os demais encolhem até o próprio texto (`flex-none`). Antes os dois eram `flex-1`, e
 * era a barra que divergia do desenho — não o rótulo.
 *
 * **E o destaque deixa de ser decidido por ÍNDICE.** `acoes[0]` acertava por coincidência: a ordem do enum
 * põe `atribuir-responsavel` antes de `iniciar-atendimento`, e em `em_analise` com responsável o destaque
 * seria *Atribuir* — na tela onde o responsável acabou de ser atribuído. Quem decide é a página, com
 * `acaoPrimaria`, e a barra recebe pronto (achado **R-08**).
 *
 * **Alvo de toque ≥ 44 px** (`h-12`) e **rótulo em palavra** — A-3 e A-5.
 */
export type AcaoDisponivel = { comando: string; rotulo: string };

export function BarraDeAcoes({
  ocorrenciaId,
  acoes,
  rotulosDeStatus,
  organizacaoId,
  formularios = {},
  primario = null,
  emMenu = [],
}: {
  ocorrenciaId: string;
  /** Já filtrada pelo servidor: só o que tem rótulo e forma, na ordem de `acoesDisponiveis`. */
  acoes: readonly AcaoDisponivel[];
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** Para cada comando com forma própria, o nó pronto. Ausente = botão de disparo direto. */
  formularios?: Readonly<Record<string, ReactNode>>;
  /**
   * O comando em destaque, decidido pela página com `acaoPrimaria`. **`null` cai em `acoes[0]`**, que é o
   * comportamento anterior — e é o que mantém a barra usável por quem não passar o campo.
   */
  primario?: string | null;
  /**
   * Os comandos que vão **dentro** do menu *"Mais ações ▾"*, decididos pela página com `acoesDaBarra`.
   * Vazio é o caso de um ou dois renderizáveis, e é o comportamento anterior — dois botões lado a lado.
   */
  emMenu?: readonly string[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * **Some quando não há ação NEM aviso — e a segunda metade é o ponto.**
   *
   * Depois de um `409` a lista pode ficar vazia, e se o componente sumisse aqui o `router.refresh()`
   * desmontaria a frase *"Esta ocorrência mudou enquanto você estava olhando"* no exato caso em que ela
   * existe para ser lida. A tela mantém o componente montado (`page.tsx` o renderiza sempre) e ele decide
   * sozinho se tem algo a mostrar.
   */
  if (acoes.length === 0 && aviso === null) return null;

  async function disparar(comando: string) {
    setEnviando(true);
    setAviso(null);

    // **A tela envia `{}`** — este caminho é só dos comandos sem formulário, que é o botão nu (D23). O
    // `corpoOpcional` do servidor existe para o cliente que NÃO é esta tela.
    const resultado = await executarComando(
      ocorrenciaId,
      comando,
      {},
      rotulosDeStatus,
      organizacaoId,
    );
    if (!resultado.ok) setAviso(resultado.aviso);
    setEnviando(false);

    /**
     * **O `refresh` roda nos DOIS desfechos, e é decisão.** No sucesso ele repinta rótulo, histórico e
     * barra a partir de **uma fonte só**. No `409` ele faz o mesmo: consumir o `acoesDisponiveis` que vem
     * no corpo do erro atualizaria os botões deixando o resto da tela com o status velho.
     *
     * **O aviso sobrevive porque o componente não é desmontado**: `page.tsx` o renderiza sempre.
     */
    router.refresh();
  }

  return (
    <>
      {/* A barra é `fixed`; sem este espaçador o *Voltar* fica embaixo dela. **Ele vem antes da barra e
          DEPOIS do resto do documento** — `page.tsx` monta este componente como último filho —, porque
          espaçador colocado acima do *Voltar* não cria folga abaixo dele. E ele aparece e some junto com a
          barra, inclusive no caso em que só há aviso. */}
      <div aria-hidden className="h-24" />
      <div className="border-linha bg-superficie fixed inset-x-0 bottom-0 z-10 border-t px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {aviso !== null && (
            <p
              role="alert"
              className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
            >
              {aviso}
            </p>
          )}
          {acoes.length > 0 && (
            <div className="flex gap-2">
              {acoes
                .filter((acao) => !emMenu.includes(acao.comando))
                .map((acao) => {
                  const ehPrimario = acao.comando === (primario ?? acoes[0]?.comando);
                  const formulario = formularios[acao.comando];
                  // **O nó já vem com a própria variante**, decidida pela página: ela é quem sabe qual
                  // ação é a primeira, e é ela quem monta o gatilho.
                  if (formulario !== undefined) {
                    return (
                      <div key={acao.comando} className={ehPrimario ? "flex-1" : "flex-none"}>
                        {formulario}
                      </div>
                    );
                  }

                  return (
                    <Button
                      key={acao.comando}
                      type="button"
                      variant={ehPrimario ? "default" : "outline"}
                      disabled={enviando}
                      onClick={() => void disparar(acao.comando)}
                      className={`h-12 text-base ${ehPrimario ? "flex-1" : "flex-none"}`}
                    >
                      {enviando ? "Enviando…" : acao.rotulo}
                    </Button>
                  );
                })}

              {/* **O menu, e o rótulo carrega PALAVRA — A-5.** *"Mais ações ▾"*, nunca `⋯`: o `⋯` dos
                  filtros no celular já está declarado como dívida contra o compromisso A-5, e este item
                  não cria a segunda. A geometria é a mesma do item 22: o primário cresce (`flex-1`), o
                  gatilho do menu encolhe até o texto (`flex-none`).

                  **`modal={false}` é o par do `onSelect` prevenido dos itens do menu:** com `modal`
                  ligado, o menu prende o foco e trava a rolagem, e o diálogo que abre por cima disputa
                  as duas coisas com ele. */}
              {emMenu.length > 0 && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="h-12 flex-none text-base">
                      Mais ações ▾
                    </Button>
                  </DropdownMenuTrigger>
                  {/* **`Fragment`, e NÃO um `<div>` de embrulho**: o `DropdownMenuContent` publica
                      `role="menu"`, e um `div` intermediário deixaria de novo um filho que não é
                      `menuitem` — exatamente o que a variante `"menu"` dos modais existe para evitar. O
                      `Dialog` do Radix não emite DOM próprio, então o filho direto do menu passa a ser o
                      `DropdownMenuItem` de dentro do modal. */}
                  <DropdownMenuContent align="end">
                    {emMenu.map((comando) => (
                      <Fragment key={comando}>{formularios[comando]}</Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
