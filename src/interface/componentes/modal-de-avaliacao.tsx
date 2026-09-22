"use client";

import { useId, useState } from "react";

import {
  Campo,
  ErroDoFormulario,
  GrupoDeEscolha,
  IndicadorDeEnvio,
  RodapeDoFormulario,
} from "@/interface/componentes/campo";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import type { TextosDoRetorno } from "@/interface/componentes/retorno-de-acao";
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
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/** As cinco opções da escala. **Legenda só nas pontas** — é o desenho do protótipo §7.2, literal. */
const NOTAS = [
  { valor: 1, descricao: "muito ruim" },
  { valor: 2, descricao: null },
  { valor: 3, descricao: null },
  { valor: 4, descricao: null },
  { valor: 5, descricao: "muito bom" },
] as const;

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
 * **A nota é `RadioGroup` e não estrelas, e o protótipo já decidiu com o custo escrito:** *"Não há
 * componente de nota no catálogo … Ganha-se acessibilidade de graça e **perde-se reconhecimento**: as
 * pessoas esperam estrelas"* (`prototipo-low-fi.md:1012-1017`). Como o **O4** depende de a avaliação ser
 * fácil, isso é custo real, e é candidato ao que o artefato clicável mediria.
 *
 * **As cinco opções ficam em COLUNA.** Cinco alvos de 44 px lado a lado não cabem em 390 px menos as
 * bordas sem encolher o alvo, que é o compromisso **A-3**. As legendas das pontas viram descrição da
 * primeira e da última opção, **dentro do `<label>`** — a mesma marcação que o item 18 usou para
 * *Duplicada*, e pelo mesmo motivo: descrição ancorada separadamente seria lida duas vezes.
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
 * **A variante nunca é `"menu"`, e a prova está no parágrafo *"Corrigido no item 18"* do cabeçalho de
 * `barra-de-acoes.tsx`**, escrita com o nome deste item: `ACAO_PRIMARIA.resolvida === "avaliar"`, e `emMenu`
 * exclui o destaque por construção. Sempre que `avaliar` é renderizável, ele **é** o destaque.
 *
 * **Acessibilidade:** `fieldset`/`legend` para o grupo (A-1), `<label htmlFor>` de verdade nas cinco opções e
 * no comentário, `min-h-11` nas opções e no campo e `h-11`/`h-12` nos botões (A-3), o erro do servidor em
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
    <Dialog open={envio.aberto} onOpenChange={envio.mudarAbertura}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variante === "primario" ? "marca" : "outline"}
          className={
            variante === "primario" ? "text-interface h-12 w-full" : "text-interface h-12 w-auto lg:w-full"
          }
        >
          Avaliar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliar</DialogTitle>
          {/* **Frase nova de produto**, declarada no achado A-2 da spec para o hub confirmar ou trocar;
              trocá-la não muda uma linha de estrutura. */}
          <DialogDescription>Como foi a resolução?</DialogDescription>
        </DialogHeader>

        <GrupoDeEscolha id={grupoId} legenda="Nota" obrigatorio erro={formulario.erroDe("nota")}>
          {NOTAS.map((opcao) => {
            const id = `${grupoId}-${String(opcao.valor)}`;
            return (
              <label
                key={opcao.valor}
                htmlFor={id}
                className="border-linha group-data-invalido:border-destructive/[75%] text-interface flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
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
                    formulario.mudou("nota");
                  }}
                  className="size-4"
                />
                {/* **A legenda da ponta vai DENTRO do `<label>`**, e não em `aria-describedby`: o nome
                    acessível já a inclui, e uma descrição ancorada à parte a leria duas vezes (A-1). */}
                <span className="text-tinta">
                  {opcao.valor}
                  {opcao.descricao !== null && (
                    <span className="text-tinta-suave">{`, ${opcao.descricao}`}</span>
                  )}
                </span>
              </label>
            );
          })}
        </GrupoDeEscolha>

        {/* **Sem aviso de visibilidade, e a ausência é decisão:** a restrição herdada nº 1 do inventário
            enumera *"modais que têm campo `observacao`"*, e este tem `comentario`. Inventar a frase aqui
            seria escrever texto de produto num componente. */}
        <Campo id={campoComentarioId} rotulo="Comentário (opcional)">
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

        <RodapeDoFormulario obrigatorios={1}>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11" disabled={envio.enviando}>
              Fechar
            </Button>
          </DialogClose>
          <Button type="button" className="h-11" disabled={envio.enviando} onClick={confirmar}>
            <IndicadorDeEnvio ativo={envio.enviando} />
            {envio.enviando ? "Enviando…" : "Enviar avaliação"}
          </Button>
        </RodapeDoFormulario>
      </DialogContent>
    </Dialog>
  );
}
