"use client";

import { useId, useState } from "react";

import { Campo, ErroDoFormulario, GrupoDeEscolha } from "@/interface/componentes/campo";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import type { TextosDoRetorno } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { DropdownMenuItem } from "@/interface/componentes/ui/dropdown-menu";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { useEnvioDoModal } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * Uma opção do grupo. **O rótulo chega PRONTO** — o navegador não monta rótulo (R4).
 *
 * **A `descricao` é opcional e nasceu no item 18**, para a opção *Duplicada*: quem a escolhe espera que
 * o produto ligue as duas ocorrências, e o vínculo é evolução prevista. **A condição é POR OPÇÃO, não
 * por modal** — `pausar` não passa descrição em nenhuma das quatro, e a tela do item 23 não muda um
 * pixel.
 */
export type OpcaoDeMotivo = { valor: string; rotulo: string; descricao?: string };

/**
 * ============================================================================
 *  O quarto modal — escolha e observação obrigatórias
 * ============================================================================
 *
 * **Parametrizado, e o parâmetro é a lista de motivos.** `pausar` (item 23) e `cancelar` (item 18) são
 * o mesmo formulário: escolha única obrigatória + observação obrigatória + aviso de visibilidade.
 * Diferem em três strings e no conteúdo da lista — e a do 18 é **filtrada por papel** na própria tela,
 * o que é dado de entrada, não estrutura. É o mesmo movimento que o item 22 fez com
 * `ModalDeObservacao` para 22 e 24, e a razão é a mesma: escrever dois arquivos iguais é a cópia de
 * sempre.
 *
 * **Nenhum tipo do Domínio entra aqui**, como nos três anteriores: `comando` é `string`, `valor` é
 * `string`, os rótulos chegam prontos, o mapa de status chega pronto.
 *
 * **O envio segue a sequência de modal do guia §7**, pelo `useEnvioDoModal` (item 44g): carregando no
 * modal, que não fecha durante o envio; sucesso com aviso, modal fechado e página atualizada; erro com
 * aviso e mensagem no modal aberto, e o fechamento depois de um erro atualiza a página. **O botão
 * principal só fica inerte durante o envio**: clicado com campo obrigatório vazio, ele mostra os erros e
 * leva o foco ao primeiro (guia §7, decidido em 16/09/2026).
 *
 * **Acessibilidade:** `fieldset` + `legend` para o grupo, `<label htmlFor>` de verdade em cada opção
 * (A-1), o aviso é **descrição do campo**, ancorado por `aria-describedby` e renderizado **antes** dele,
 * `min-h-11` nas opções e no campo e `h-11`/`h-12` nos botões (A-3), e todo estado vai em palavra (A-5).
 * O foco preso, o `Esc` e o foco devolvido ao gatilho vêm do `Dialog` do `radix-ui` (A-2 e A-4).
 */
export function ModalDeMotivo({
  ocorrenciaId,
  comando,
  titulo,
  descricao,
  rotuloDoGrupo,
  motivos,
  rotuloDoGatilho,
  rotuloDeConfirmar,
  verboEnviando,
  avisoDeVisibilidade,
  variante,
  rotulosDeStatus,
  organizacaoId,
  retorno,
  destrutivo = false,
}: {
  ocorrenciaId: string;
  /** O caminho do endpoint. **`string`, nunca `Comando`** — o Domínio não entra no navegador. */
  comando: string;
  titulo: string;
  descricao: string;
  /** O texto do `legend` — *"Motivo"*. */
  rotuloDoGrupo: string;
  /** **Nenhum vem pré-selecionado** — o protótipo não marca nenhum `checked`. */
  motivos: readonly OpcaoDeMotivo[];
  rotuloDoGatilho: string;
  rotuloDeConfirmar: string;
  /** O rótulo do botão enquanto envia — *"Pausando…"*, *"Cancelando…"*. */
  verboEnviando: string;
  /**
   * A frase sob *Observação* — a **restrição herdada nº 1** do inventário de telas.
   *
   * **Chega por prop, e é OBRIGATÓRIA.** Ela morava importada direto de `rotulos.ts`, e o item 18 a
   * tirou daqui porque `cancelar` tem **duas**: `AVISO_DE_VISIBILIDADE` para quem gestiona,
   * `AVISO_PARA_QUEM_NAO_GESTIONA` para o Solicitante autor (critério 18.7).
   *
   * **Obrigatória, e não opcional com padrão**, e o argumento é o mesmo do segundo parâmetro de
   * `vazioDaBarra`: esta é a frase que diz **quem lê o que você está escrevendo, sem volta**. Padrão
   * silencioso faria o chamador que esquecesse mostrar a frase do Gestor a um Solicitante — que é
   * exatamente o defeito que o 18.7 existe para fechar. Obrigatória, o compilador cobra os dois
   * chamadores.
   *
   * > **O nome não é `aviso`, e a diferença não é estética:** `aviso` já é o estado do envio que carrega a
   * > frase do `409`. Duas coisas com o mesmo nome no mesmo escopo é o defeito que o compilador pegaria
   * > hoje e que o leitor pagaria para sempre.
   */
  avisoDeVisibilidade: string;
  /**
   * **Três variantes, e a terceira é do item 23:** `"menu"` renderiza o gatilho como
   * `DropdownMenuItem`, para o modal poder viver dentro do *"Mais ações ▾"*.
   */
  variante: "primario" | "secundario" | "menu";
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** Os títulos do aviso de sucesso e de falha, prontos (`RETORNO_DO_COMANDO`). */
  retorno: TextosDoRetorno;
  /**
   * **Ação que cancela usa a variante `destructive`** (guia §7, critério 44g.5). A página liga só no
   * `cancelar`; o `pausar` continua com o botão padrão.
   */
  destrutivo?: boolean;
}) {
  const grupoId = useId();
  const campoId = useId();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  const formulario = useFormularioTocado({
    campos: { motivo: grupoId, observacao: campoId },
    erros: {
      motivo: escolhido === null ? "Escolha o motivo." : undefined,
      observacao: texto.trim() === "" ? "Escreva a observação." : undefined,
    },
  });

  const envio = useEnvioDoModal({
    // **A tela manda o que digitou, sem aparar.** Quem apara é o comando de aplicação, num lugar só.
    enviar: () =>
      executarComando(
        ocorrenciaId,
        comando,
        { motivo: escolhido, observacao: texto },
        rotulosDeStatus,
        organizacaoId,
      ),
    aoConcluir: () => ({ titulo: retorno.sucesso }),
    tituloDaFalha: retorno.falha,
    aoAbrir: () => {
      setEscolhido(null);
      setTexto("");
      formulario.recomecar();
    },
  });

  function confirmar() {
    if (formulario.tentarEnviar()) void envio.confirmar();
  }

  /**
   * **O gatilho, nas três formas.**
   *
   * No menu, `DropdownMenuContent` do Radix **desmonta os filhos ao fechar**, e selecionar um item
   * fecha o menu por padrão — um `Dialog` montado lá dentro morreria no mesmo instante em que o clique
   * deveria abri-lo. `onSelect` prevenido é o que impede isso.
   *
   * **O custo, declarado:** o menu **fica aberto atrás do diálogo** e continua aberto quando ele fecha.
   * É o preço de o `Dialog` não ser desmontado, e é aceitável — o repinte já acontece no fechamento do
   * diálogo, e o menu reabre com a lista nova.
   */
  const gatilho =
    variante === "menu" ? (
      <DropdownMenuItem
        className="min-h-11"
        onSelect={(evento) => {
          evento.preventDefault();
        }}
      >
        {rotuloDoGatilho}
      </DropdownMenuItem>
    ) : (
      <Button
        type="button"
        variant={variante === "primario" ? "marca" : "outline"}
        /* **A largura vem da variante, não do *shrink-to-fit*** — é `.actionbar .btn.ghost
           { width: auto }` do protótipo, e dispensa apostar em como o navegador resolve `w-full`
           dentro de um invólucro `flex-none`. */
        className={
          variante === "primario" ? "text-interface h-12 w-full" : "text-interface h-12 w-auto lg:w-full"
        }
      >
        {rotuloDoGatilho}
      </Button>
    );

  return (
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      gatilho={gatilho}
      titulo={titulo}
      descricao={descricao}
      /* **Os dois campos são obrigatórios**, então a nota do rodapé sai e o asterisco fica
         (critério 44p.11). */
      obrigatorios={2}
      todosObrigatorios
      aoEnviar={(evento) => {
        evento.preventDefault();
        confirmar();
      }}
      rodape={
        <>
          <BotaoDeCancelar enviando={envio.enviando} />
          <BotaoDeConfirmar
            enviando={envio.enviando}
            variante={destrutivo ? "destrutiva" : undefined}
            rotulo={rotuloDeConfirmar}
            rotuloEnviando={verboEnviando}
          />
        </>
      }
    >
      <GrupoDeEscolha
        id={grupoId}
        legenda={rotuloDoGrupo}
        obrigatorio
        erro={formulario.erroDe("motivo")}
      >
        {motivos.map((motivo) => {
          const id = `${grupoId}-${motivo.valor}`;
          return (
            <label
              key={motivo.valor}
              htmlFor={id}
              /* **`items-start` só quando há descrição**, para o rádio alinhar com a PRIMEIRA linha em
                 vez de centralizar num bloco de duas. `min-h-11` continua nos dois casos, e o alvo de
                 toque cresce em vez de encolher (A-3). */
              className={`border-linha group-data-invalido:border-destructive/[75%] text-interface flex min-h-11 cursor-pointer gap-3 rounded-md border px-3 ${
                motivo.descricao === undefined ? "items-center py-2" : "items-start py-2.5"
              }`}
            >
              {/* **A-1:** rótulo associado ao controle — clicar no texto seleciona. */}
              <input
                type="radio"
                id={id}
                name={grupoId}
                value={motivo.valor}
                required
                disabled={envio.enviando}
                checked={escolhido === motivo.valor}
                onChange={() => {
                  setEscolhido(motivo.valor);
                  formulario.mudou("motivo");
                }}
                className="mt-0.5 size-4"
              />
              {/* **A descrição vai DENTRO do `<label>`, e não em `aria-describedby`**: o nome
                  acessível da opção já a inclui, e uma descrição ancorada separadamente a leria duas
                  vezes (A-1). */}
              <span className="flex flex-col gap-0.5">
                <span className="text-tinta">{motivo.rotulo}</span>
                {motivo.descricao !== undefined && (
                  <span className="text-tinta-suave text-meta leading-relaxed">
                    {motivo.descricao}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </GrupoDeEscolha>

      <Campo
        id={campoId}
        rotulo="Observação"
        obrigatorio
        ajuda={avisoDeVisibilidade}
        ajudaAntes
        erro={formulario.erroDe("observacao")}
      >
        {(controle) => (
          <Textarea
            {...controle}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              formulario.mudou("observacao");
            }}
            disabled={envio.enviando}
            rows={3}
            /* **O mesmo teto do `pausaSchema`** — 1000. Dois números divergiriam. */
            maxLength={1000}
          />
        )}
      </Campo>

      {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
