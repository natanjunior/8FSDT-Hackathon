"use client";

import { Star } from "lucide-react";
import { useId, useState } from "react";

import { Campo, ErroDoFormulario, GrupoDeEscolha } from "@/interface/componentes/campo";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import type { TextosDoRetorno } from "@/interface/componentes/retorno-de-acao";
import { NOTAS_DA_AVALIACAO, nomeDaNota, textoDaNota } from "@/interface/componentes/rotulos";
import { Button } from "@/interface/componentes/ui/button";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { cn } from "@/interface/componentes/utilitarios";
import { useEnvioDoModal } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  O QUINTO modal do produto — e o único com campo numérico
 * ============================================================================
 *
 * **Componente próprio, e não o `ModalDeMotivo` parametrizado.** Ele é *quase* a mesma forma — escolha
 * única obrigatória + campo de texto —, e as três diferenças são todas de **contrato**, não de estilo:
 *
 * | | `ModalDeMotivo` | aqui |
 * |---|---|---|
 * | Campo de texto | **obrigatório** (invariante 5) | **opcional** (`openapi.yaml:2054`, `required: [nota]` só) |
 * | Aviso de visibilidade | **obrigatório** | **não existe** — a restrição herdada nº 1 do inventário enumera *"modais que têm campo `observacao`"*, e este tem `comentario` |
 * | Valor da opção | `string` (o enum do motivo) | **`number`** (a nota) |
 *
 * Reusá-lo exigiria tornar opcionais **duas** props que o item 18 tornou obrigatórias com argumento escrito
 * (o docblock de `avisoDeVisibilidade`, em `modal-de-motivo.tsx`: *"padrão silencioso faria o chamador que
 * esquecesse mostrar a frase do Gestor a um Solicitante"*) — desfazer decisão de outro item para economizar
 * um arquivo. **Recusado.**
 *
 * **A nota são estrelas desde o item 76, e continuam rádios.** O protótipo tinha escolhido rádios em
 * coluna, com o custo escrito (*"perde-se reconhecimento: as pessoas esperam estrelas"*), e o dono
 * reverteu. Cada estrela é o `<label>` de um `input type="radio"` que continua existindo, visualmente
 * oculto: o grupo, a seta, o nome por opção e o `required` são do navegador, e nada foi instalado. O
 * `@reui/rating` que o critério cita não entrou, porque não traz nenhuma dessas três coisas
 * (`respostas.md` P3 do item 76). A estrela é a `Star` do `lucide`, a mesma da faixa de avaliação.
 *
 * **Cinco alvos de 44 px numa linha só**: com 4 px de intervalo são 236 px, e cabem no modal de 390 px.
 * A conta antiga, que mandava para coluna, era de linhas com texto. O nome de cada opção é texto
 * `sr-only` **dentro do `<label>`** — a mesma marcação que o item 18 usou para *Duplicada*, e pelo mesmo
 * motivo: descrição ancorada separadamente seria lida duas vezes.
 *
 * **O envio segue a sequência de modal do guia §7**, pelo `useEnvioDoModal` (item 44g): carregando no
 * modal, que não fecha durante o envio; sucesso com aviso, modal fechado e página atualizada; erro com
 * aviso e mensagem no modal aberto, e o fechamento depois de um erro atualiza a página. **O botão
 * principal só fica inerte durante o envio**: clicado com campo obrigatório vazio, ele mostra os erros e
 * leva o foco ao primeiro (guia §7, decidido em 16/09/2026).
 *
 * **Sem nota, o clique não envia**: `nota` é `required` no schema, e a tela mostra *"Escolha uma nota."*
 * em vez de produzir um `400` que ela podia evitar. **O comentário vazio não impede nada**, porque é
 * opcional.
 *
 * **A variante é sempre `"primario"` desde o item 66.** O gatilho mora na faixa de avaliação, fora da barra,
 * e é o único *Avaliar* da tela. A barra nem recebe `avaliar` (`page.tsx`, `naBarra`).
 *
 * **Acessibilidade:** `fieldset`/`legend` para o grupo (A-1), `<label htmlFor>` de verdade nas cinco opções e
 * no comentário, `size-11` nas estrelas, `min-h-11` no campo e `h-11`/`h-12` nos botões (A-3), o erro do servidor em
 * `role="alert"` e tudo em palavra (A-5). Foco preso, `Esc` e foco devolvido ao gatilho vêm do `Dialog` do
 * `radix-ui` (A-2 e A-4).
 */
export function ModalDeAvaliacao({
  ocorrenciaId,
  variante,
  rotulosDeStatus,
  organizacaoId,
  retorno,
}: {
  ocorrenciaId: string;
  variante: "primario" | "secundario";
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** Os títulos do aviso de sucesso e de falha, prontos (`RETORNO_DO_COMANDO`). */
  retorno: TextosDoRetorno;
}) {
  const grupoId = useId();
  const campoComentarioId = useId();
  const [nota, setNota] = useState<number | null>(null);
  /** A estrela sob o ponteiro, que prevê a nota antes do clique. */
  const [sobre, setSobre] = useState<number | null>(null);
  const acesa = sobre ?? nota ?? 0;
  const [comentario, setComentario] = useState("");

  const formulario = useFormularioTocado({
    campos: { nota: grupoId },
    erros: { nota: nota === null ? "Escolha uma nota." : undefined },
  });

  const envio = useEnvioDoModal({
    // **A tela manda o que digitou, sem aparar.** Quem apara é o comando de aplicação, num lugar só — e é
    // ele que decide que vazio vira `null`. Aparar aqui criaria a segunda regra.
    enviar: () =>
      executarComando(ocorrenciaId, "avaliar", { nota, comentario }, rotulosDeStatus, organizacaoId),
    aoConcluir: () => ({ titulo: retorno.sucesso }),
    tituloDaFalha: retorno.falha,
    aoAbrir: () => {
      setNota(null);
      setComentario("");
      formulario.recomecar();
    },
  });

  function confirmar() {
    if (formulario.tentarEnviar()) void envio.confirmar();
  }

  return (
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      gatilho={
        <Button
          type="button"
          variant={variante === "primario" ? "marca" : "outline"}
          className={
            variante === "primario" ? "text-interface h-12 w-full" : "text-interface h-12 w-auto lg:w-full"
          }
        >
          Avaliar
        </Button>
      }
      titulo="Avaliar"
      /* **Frase nova de produto**, declarada no achado A-2 da spec para o hub confirmar ou trocar;
         trocá-la não muda uma linha de estrutura. */
      descricao="Como foi o atendimento?"
      /* **A nota fica**, e é o único dos cinco em que ela fica: *Quer contar mais? (opcional)* existe, então
         nem todo campo é obrigatório (critério 44p.11). */
      obrigatorios={1}
      aoEnviar={(evento) => {
        evento.preventDefault();
        confirmar();
      }}
      rodape={
        <>
          <BotaoDeCancelar enviando={envio.enviando} />
          <BotaoDeConfirmar
            enviando={envio.enviando}
            rotulo="Enviar avaliação"
            rotuloEnviando="Enviando…"
          />
        </>
      }
    >
      <GrupoDeEscolha id={grupoId} legenda="Nota" obrigatorio aoSair={formulario.aoSair("nota")} erro={formulario.erroDe("nota")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* **O ponteiro prevê a nota, e sair do grupo desfaz a previsão.** Sobre a fileira e não sobre
              cada estrela: entre duas estrelas o ponteiro não deve apagar tudo. */}
          <div className="flex gap-1" onMouseLeave={() => setSobre(null)}>
            {NOTAS_DA_AVALIACAO.map((opcao) => {
              const id = `${grupoId}-${String(opcao.valor)}`;
              return (
                <label
                  key={opcao.valor}
                  htmlFor={id}
                  onMouseEnter={() => setSobre(opcao.valor)}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-sm"
                >
                  <input
                    type="radio"
                    id={id}
                    name={grupoId}
                    value={opcao.valor}
                    required
                    disabled={envio.enviando}
                    checked={nota === opcao.valor}
                    onChange={() => {
                      setNota(opcao.valor);
                      // **A escolha do teclado vence a previsão do ponteiro** (foco da revisão 1).
                      setSobre(null);
                      formulario.mudou("nota");
                    }}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{nomeDaNota(opcao.valor)}</span>
                  <Star
                    aria-hidden="true"
                    className={cn(
                      "size-7 rounded-sm transition-colors duration-(--tempo-ponteiro) ease-(--curva-ponteiro)",
                      "peer-focus-visible:outline-marca peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                      opcao.valor <= acesa
                        ? "fill-tinta-marca text-tinta-marca"
                        : "text-linha group-data-invalido:text-destructive/[75%]",
                    )}
                  />
                </label>
              );
            })}
          </div>
          {/* **A palavra da nota** (A-5). `aria-hidden` porque o nome do rádio marcado já diz o mesmo, e
              lido duas vezes seria ruído. */}
          <span aria-hidden="true" className="text-interface text-tinta-suave">
            {textoDaNota(nota)}
          </span>
        </div>
      </GrupoDeEscolha>

      {/* **Sem aviso de visibilidade, e a ausência é decisão:** a restrição herdada nº 1 do inventário
          enumera *"modais que têm campo `observacao`"*, e este tem `comentario`. Inventar a frase aqui
          seria escrever texto de produto num componente. */}
      <Campo id={campoComentarioId} rotulo="Quer contar mais? (opcional)">
        {(controle) => (
          <Textarea
            {...controle}
            value={comentario}
            onChange={(evento) => {
              setComentario(evento.target.value);
            }}
            disabled={envio.enviando}
            rows={3}
            /* **O mesmo teto do `avaliacaoSchema`** — 1000. Dois números divergiriam. */
            maxLength={1000}
          />
        )}
      </Campo>

      {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
