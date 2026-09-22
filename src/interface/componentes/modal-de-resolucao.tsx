"use client";

import { useId, useState } from "react";

import { Campo, ErroDoFormulario } from "@/interface/componentes/campo";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import type { TextosDoRetorno } from "@/interface/componentes/retorno-de-acao";
import { AVISO_DE_VISIBILIDADE } from "@/interface/componentes/rotulos";
import { Button } from "@/interface/componentes/ui/button";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { useEnvioDoModal } from "@/interface/ganchos/use-envio-do-modal";

/**
 * ============================================================================
 *  O terceiro modal do produto — e o primeiro com DOIS campos
 * ============================================================================
 *
 * **Componente próprio, e não um parâmetro a mais no `ModalDeObservacao`.** A spec do item 22 escreveu
 * que aquele componente resolveria *"para três deles — 22, 24 e, **se a forma servir**, parte do 26"*.
 * **A forma não serve**: são dois campos, com ordem, foco, pré-preenchimento e tetos diferentes, e o
 * aviso ancorado em **um** deles. Um `campoExtra?: ReactNode` transformaria aquele componente numa
 * moldura genérica com metade da lógica na página — que é a forma de esconder duplicação em vez de
 * eliminá-la.
 *
 * **A ordem é `solucaoAplicada` primeiro, e ela é a indução da D22 inteira.** *"O formulário de resolver
 * abre com o campo em foco, e pular exige um clique a mais"* (contrato §8.4) é o **único** mecanismo que
 * existe até o interruptor por organização nascer — e o interruptor é ⬜. Invertida, a fatia entrega o
 * endpoint e perde a razão pela qual ele aceita o campo. **A ordem no DOM é a ordem de leitura** (A-2),
 * então o `autoFocus` não é atalho visual: é o primeiro campo mesmo.
 *
 * **O aviso de visibilidade fica só na `observacao`**, literal à restrição herdada nº 1 do inventário,
 * que enumera cinco modais *"que têm campo `observacao`"*. Repeti-lo nos dois campos do **mesmo** modal é
 * exatamente *"aviso que vira paisagem"*, que é o problema que o protótipo nomeia. **Que
 * `solucaoAplicada` também é lida pelo Solicitante e também congela em `resolvida` é verdade e não tem
 * texto em documento nenhum** — é o achado **A-3** da spec, e inventar a segunda frase aqui seria
 * escrever texto de produto num componente.
 *
 * **A constante é IMPORTADA do `modal-de-observacao.tsx`**, e não copiada: o terceiro modal não cria a
 * terceira string. **O lugar canônico definitivo é decisão do item 23** (achado A-5 da spec do 22).
 *
 * **O envio segue a sequência de modal do guia §7**, pelo `useEnvioDoModal` (item 44g): carregando no
 * modal, que não fecha durante o envio; sucesso com aviso, modal fechado e página atualizada; erro com
 * aviso e mensagem no modal aberto, e o fechamento depois de um erro atualiza a página. **O botão
 * principal só fica inerte durante o envio**: clicado com campo obrigatório vazio, ele mostra os erros e
 * leva o foco ao primeiro (guia §7, decidido em 16/09/2026).
 *
 * **A pré-visualização da observação NÃO está aqui**, e o dono é o critério **29.6**.
 *
 * **Acessibilidade:** `<label htmlFor>` de verdade nos **dois** campos (A-1) — `placeholder` não é
 * rótulo —, o aviso é **descrição do campo**, ancorado por `aria-describedby` e renderizado **antes**
 * dele, `min-h-11` nos campos e `h-11`/`h-12` nos botões (A-3), e todo estado vai em palavra (A-5). O
 * foco preso, o `Esc` e o foco devolvido ao gatilho vêm do `Dialog` do `radix-ui` (A-2 e A-4).
 */
export function ModalDeResolucao({
  ocorrenciaId,
  solucaoAplicadaAtual,
  variante,
  rotulosDeStatus,
  organizacaoId,
  retorno,
}: {
  ocorrenciaId: string;
  /**
   * A solução já gravada, para o campo abrir pré-preenchido.
   *
   * **Desde o item 25 ela tem valor de verdade:** o campo no corpo de T-05 escreve a coluna, e o modal a
   * lê. Ela também é a referência de `solucaoMudou`, em `enviar` — é o que impede o modal de reenviar
   * texto que ninguém digitou.
   */
  solucaoAplicadaAtual: string | null;
  variante: "primario" | "secundario";
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** Os títulos do aviso de sucesso e de falha, prontos (`RETORNO_DO_COMANDO`). */
  retorno: TextosDoRetorno;
}) {
  const campoSolucaoId = useId();
  const campoObservacaoId = useId();
  const [solucao, setSolucao] = useState(solucaoAplicadaAtual ?? "");
  const [observacao, setObservacao] = useState("");

  const envio = useEnvioDoModal({
    enviar: () => {
      /**
       * **O modal só envia `solucaoAplicada` quando o campo DIFERE do que veio pré-preenchido** — item 25,
       * §3.4, e é a resposta ao achado **A-2** da spec do item 26.
       *
       * A janela que isto fecha é do **cliente**, e é a grande: o campo é pré-preenchido com o valor da
       * **renderização da página**, que pode ter minutos. Sem esta condição, um Gestor que resolvesse **sem**
       * digitar sobrescreveria, com o valor que carregou, o texto que outro Gestor salvou dois segundos
       * antes — e o estado é terminal, então **não há conserto**.
       *
       * **Campo intocado → o comando não recebe o campo → o agregado PRESERVA o que estiver no banco**
       * (`Ocorrencia.ts`). A semântica *"ausente = preserva"* foi construída pelo item 26 exatamente para
       * isto, e estava sem caso de uso. **Nenhum conceito novo, nenhuma coluna, nenhuma linha de servidor.**
       *
       * **A janela de milissegundos do servidor fica, e fica declarada:** `/resolver`, `/pausar` e `/retomar`
       * transcrevem `ocorrencia.solucaoAplicada` no `update` da transição, então um
       * `/registrar-solucao-aplicada` que caia entre o `carregar` e o `update` deles é sobrescrito. É a mesma
       * espécie que a §7.9 aceita, ordens de grandeza menor, e defender contra ela exigiria versionar a
       * linha — que é o que a §7.9 recusou.
       */
      const solucaoMudou = solucao !== (solucaoAplicadaAtual ?? "");
      const corpo = solucaoMudou ? { solucaoAplicada: solucao, observacao } : { observacao };

      // **A tela manda o que digitou, sem aparar.** Quem apara é o comando de aplicação, num lugar só — e
      // é ele que decide que vazio vira `null`. Aparar aqui também criaria a segunda regra.
      return executarComando(ocorrenciaId, "resolver", corpo, rotulosDeStatus, organizacaoId);
    },
    aoConcluir: () => ({ titulo: retorno.sucesso }),
    tituloDaFalha: retorno.falha,
    // **A solução volta ao que está GRAVADO**, e não a vazio: o campo é pré-preenchido, não rascunho.
    aoAbrir: () => {
      setSolucao(solucaoAplicadaAtual ?? "");
      setObservacao("");
    },
  });

  return (
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      gatilho={
        <Button
          type="button"
          variant={variante === "primario" ? "marca" : "outline"}
          /* **A largura vem da variante, não do *shrink-to-fit*** — a geometria que o item 22 firmou. */
          className={
            variante === "primario" ? "text-interface h-12 w-full" : "text-interface h-12 w-auto lg:w-full"
          }
        >
          Resolver
        </Button>
      }
      titulo="Resolver"
      /* **Os dois fatos do estado terminal, e é a única frase nova de produto desta fatia.** Ela está
         declarada no achado A-3 da spec para o hub confirmar ou trocar; trocá-la não muda uma linha de
         estrutura. */
      descricao="A ocorrência será encerrada. Não há como reabrir."
      /* **Sem nota de obrigatório:** os dois campos são opcionais (D23, e o critério 25.4: resolver sem
         solução responde `200`). A indução é o foco, nunca a trava. */
      obrigatorios={0}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void envio.confirmar();
      }}
      rodape={
        <>
          <BotaoDeCancelar enviando={envio.enviando} />
          <BotaoDeConfirmar
            enviando={envio.enviando}
            rotulo="Resolver"
            rotuloEnviando="Resolvendo…"
          />
        </>
      }
    >
      {/* **PRIMEIRO campo, em foco.** É a indução da D22, e é o único mecanismo que existe até o
          interruptor por organização nascer. */}
      <Campo id={campoSolucaoId} rotulo="Solução aplicada">
        {(controle) => (
          <Textarea
            {...controle}
            autoFocus
            value={solucao}
            onChange={(evento) => setSolucao(evento.target.value)}
            disabled={envio.enviando}
            rows={4}
            /* **O mesmo teto do `resolucaoSchema`** — 4000. Dois números divergiriam. */
            maxLength={4000}
          />
        )}
      </Campo>

      {/* **SEGUNDO campo**, com o aviso ANTES dele: a restrição herdada nº 1. */}
      <Campo
        id={campoObservacaoId}
        rotulo="Observação (opcional)"
        ajuda={AVISO_DE_VISIBILIDADE}
        ajudaAntes
      >
        {(controle) => (
          <Textarea
            {...controle}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            disabled={envio.enviando}
            rows={3}
            /* **O mesmo teto do campo `observacao` do módulo de schemas** — 1000. */
            maxLength={1000}
          />
        )}
      </Campo>

      {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
