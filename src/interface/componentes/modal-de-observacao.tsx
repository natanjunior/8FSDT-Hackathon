"use client";

import { useId, useState } from "react";

import {
  Campo,
  ErroDoFormulario,
  IndicadorDeEnvio,
  RodapeDoFormulario,
} from "@/interface/componentes/campo";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import type { TextosDoRetorno } from "@/interface/componentes/retorno-de-acao";
import { AVISO_DE_VISIBILIDADE } from "@/interface/componentes/rotulos";
import { Button } from "@/interface/componentes/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/interface/componentes/ui/dialog";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { useEnvioDoModal } from "@/interface/ganchos/use-envio-do-modal";

/**
 * ============================================================================
 *  O modal parametrizado de `observacao` — e os DOIS comandos que ele serve
 * ============================================================================
 *
 * **Um componente parametrizado, não um por comando.** O modal de `iniciar-atendimento` (item 22) e o
 * de `retomar` (item 24) diferem em **três strings**: título, descrição e rótulo do gatilho — e a
 * partir do item 24 os dois existem, montados pela página com as mesmas **doze** props. Escrever dois
 * arquivos iguais seria a cópia de sempre — e a estrutura de `formularios` que o item 19 criou já aceita
 * qualquer nó pronto, sem a barra ganhar um `if`.
 *
 * **Nenhum tipo do Domínio entra aqui**, como na barra e no modal de atribuição: `comando` é `string`, os
 * rótulos chegam prontos, o mapa de status chega pronto. Importar `@/interface/projecoes` arrastaria
 * `comandosDisponiveis` — a máquina de estados inteira — para o pacote do navegador, que é literalmente a
 * segunda cópia que `acoesDisponiveis` existe para impedir.
 *
 * **O envio segue a sequência de modal do guia §7**, pelo `useEnvioDoModal` (item 44g): carregando no
 * modal, que não fecha durante o envio; sucesso com aviso, modal fechado e página atualizada; erro com
 * aviso e mensagem no modal aberto, e o fechamento depois de um erro atualiza a página. **O botão
 * principal só fica inerte durante o envio**: clicado com campo obrigatório vazio, ele mostra os erros e
 * leva o foco ao primeiro (guia §7, decidido em 16/09/2026).
 *
 * **A pré-visualização da observação NÃO está aqui**, e o dono é o critério **29.6**: *"na forma em que o
 * Solicitante vai lê-la"* é a linha do tempo, que é o item 29 e não existe — e o achado **P-10** diz que
 * a tela do Gestor **nunca** poderá mostrar exatamente o que o Solicitante lê, porque `statusRotulo`
 * depende de quem lê. Pré-visualização quase certa, diante do que não se apaga, é pior que nenhuma.
 *
 * **Acessibilidade:** `<label htmlFor>` de verdade (A-1) — `placeholder` não é rótulo —, o aviso é
 * **descrição do campo**, ancorada por `aria-describedby` e renderizada **antes** dele (critério 22.5),
 * `min-h-11` no campo e `h-11`/`h-12` nos botões (A-3), e todo estado vai em palavra (A-5). O foco preso,
 * o `Esc` e o foco devolvido ao gatilho vêm do `Dialog` do `radix-ui` (A-2 e A-4).
 */
export function ModalDeObservacao({
  ocorrenciaId,
  comando,
  titulo,
  descricao,
  rotuloDoGatilho,
  rotuloDoCampo,
  rotuloDeConfirmar,
  verboEnviando,
  variante,
  rotulosDeStatus,
  organizacaoId,
  retorno,
}: {
  ocorrenciaId: string;
  /** O caminho do endpoint. **`string`, nunca `Comando`** — o Domínio não entra no navegador. */
  comando: string;
  titulo: string;
  descricao: string;
  rotuloDoGatilho: string;
  rotuloDoCampo: string;
  rotuloDeConfirmar: string;
  /** O rótulo do botão enquanto envia — *"Iniciando…"*, *"Retomando…"*. */
  verboEnviando: string;
  variante: "primario" | "secundario";
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** Os títulos do aviso de sucesso e de falha, prontos (`RETORNO_DO_COMANDO`). */
  retorno: TextosDoRetorno;
}) {
  const campoId = useId();
  const [texto, setTexto] = useState("");

  const envio = useEnvioDoModal({
    // **A tela manda o que digitou, sem aparar.** Quem apara é o comando de aplicação, num lugar só — e é
    // ele que decide que vazio vira `null`. Aparar aqui também criaria a segunda regra.
    enviar: () =>
      executarComando(ocorrenciaId, comando, { observacao: texto }, rotulosDeStatus, organizacaoId),
    aoConcluir: () => ({ titulo: retorno.sucesso }),
    tituloDaFalha: retorno.falha,
    aoAbrir: () => setTexto(""),
  });

  return (
    <Dialog open={envio.aberto} onOpenChange={envio.mudarAbertura}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variante === "primario" ? "marca" : "outline"}
          /* **A largura vem da variante, não do *shrink-to-fit*** (D-P4). É `.actionbar .btn.ghost
             { width: auto }` do protótipo, e dispensa apostar em como o navegador resolve `w-full`
             dentro de um invólucro `flex-none`. */
          className={
            variante === "primario" ? "h-12 w-full text-base" : "h-12 w-auto text-base lg:w-full"
          }
        >
          {rotuloDoGatilho}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {/* O aviso de visibilidade é descrição do campo e vem ANTES dele (critério 22.5). */}
        <Campo id={campoId} rotulo={rotuloDoCampo} ajuda={AVISO_DE_VISIBILIDADE} ajudaAntes>
          {(controle) => (
            <Textarea
              {...controle}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              disabled={envio.enviando}
              rows={3}
              /* **O mesmo teto do `comandoComObservacaoSchema`** — 1000. Dois números divergiriam. */
              maxLength={1000}
            />
          )}
        </Campo>

        {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}

        {/* **Sem nota de obrigatório:** a observação é opcional (D23: *"campo obrigatório em momento
            rotineiro é preenchido com 'ok' e o dado morre"*). */}
        <RodapeDoFormulario obrigatorios={0}>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11" disabled={envio.enviando}>
              Fechar
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="h-11"
            disabled={envio.enviando}
            onClick={() => void envio.confirmar()}
          >
            <IndicadorDeEnvio ativo={envio.enviando} />
            {envio.enviando ? verboEnviando : rotuloDeConfirmar}
          </Button>
        </RodapeDoFormulario>
      </DialogContent>
    </Dialog>
  );
}
