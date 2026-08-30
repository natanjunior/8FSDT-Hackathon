"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { Button } from "@/interface/componentes/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/interface/componentes/ui/dialog";

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
 * única obrigatória + campo de texto + confirmar desabilitado —, e as três diferenças são todas de
 * **contrato**, não de estilo:
 *
 * | | `ModalDeMotivo` | aqui |
 * |---|---|---|
 * | Campo de texto | **obrigatório** (invariante 5) | **opcional** (`openapi.yaml:2054`, `required: [nota]` só) |
 * | Aviso de visibilidade | **obrigatório** | **não existe** — a restrição herdada nº 1 do inventário enumera *"modais que têm campo `observacao`"*, e este tem `comentario` |
 * | Valor da opção | `string` (o enum do motivo) | **`number`** (a nota) |
 *
 * Reusá-lo exigiria tornar opcionais **duas** props que o item 18 tornou obrigatórias com argumento
 * escrito (`modal-de-motivo.tsx:95-106`: *"padrão silencioso faria o chamador que esquecesse mostrar a
 * frase do Gestor a um Solicitante"*) — desfazer decisão de outro item para economizar um arquivo.
 * **Recusado.**
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
 * **Confirmar é desabilitado enquanto `nota === null`, e é a decisão do `ModalDeMotivo` pela mesma
 * razão exata:** `nota` é `required` no schema, então habilitar produziria um `400` que a tela podia
 * evitar — e `400` que a navegação normal alcança é defeito de tela. **O comentário vazio não desabilita
 * nada**, porque é opcional.
 *
 * **O ciclo de repinte é herdado, não redescoberto:** `aberto · enviando · aviso · precisaRepintar`, com
 * o repinte **no fechamento** e nunca no erro (furo F-2, fechado na revisão do item 19). **É a quinta
 * cópia, e a última** — não há sexto modal, porque não há décimo primeiro comando. **A extração do
 * `useComandoDeModal` continua não sendo feita, e agora a decisão é do hub**: se ela vale, vale agora ou
 * nunca (achado **A-3** da spec).
 *
 * **A variante nunca é `"menu"`, e a prova está em `barra-de-acoes.tsx:69-72`**, escrita com o nome deste
 * item: `ACAO_PRIMARIA.resolvida === "avaliar"`, e `emMenu` exclui o destaque por construção. Sempre que
 * `avaliar` é renderizável, ele **é** o destaque.
 *
 * **Acessibilidade:** `fieldset`/`legend` para o grupo (A-1), `<label htmlFor>` de verdade nas cinco
 * opções e no comentário, `min-h-11` nas opções e no campo e `h-11`/`h-12` nos botões (A-3), erro em
 * `role="alert"` e tudo em palavra (A-5). Foco preso, `Esc` e foco devolvido ao gatilho vêm do `Dialog`
 * do `radix-ui` (A-2 e A-4).
 */
export function ModalDeAvaliacao({
  ocorrenciaId,
  variante,
  rotulosDeStatus,
  organizacaoId,
}: {
  ocorrenciaId: string;
  variante: "primario" | "secundario";
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
}) {
  const router = useRouter();
  const grupoId = useId();
  const campoComentarioId = useId();
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [precisaRepintar, setPrecisaRepintar] = useState(false);

  /** **O repinte acontece AO FECHAR, e nunca ao falhar.** Ver o bloco acima. */
  function aoMudarAbertura(proximo: boolean) {
    setAberto(proximo);

    if (proximo) {
      // Reabrir começa limpo — aviso velho ao lado de nota nova é a pior combinação possível.
      setAviso(null);
      setNota(null);
      setComentario("");
      setPrecisaRepintar(false);
      return;
    }

    if (precisaRepintar) {
      setPrecisaRepintar(false);
      router.refresh();
    }
  }

  async function confirmar() {
    if (nota === null) return;

    setEnviando(true);
    setAviso(null);

    // **A tela manda o que digitou, sem aparar.** Quem apara é o comando de aplicação, num lugar só — e é
    // ele que decide que vazio vira `null`. Aparar aqui criaria a segunda regra.
    const resultado = await executarComando(
      ocorrenciaId,
      "avaliar",
      { nota, comentario },
      rotulosDeStatus,
      organizacaoId,
    );

    setEnviando(false);
    setPrecisaRepintar(true);

    if (resultado.ok) {
      aoMudarAbertura(false);
      // `precisaRepintar` ainda não valia quando `aoMudarAbertura` leu o estado — o React agenda.
      router.refresh();
      return;
    }

    setAviso(resultado.aviso);
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAbertura}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variante === "primario" ? "default" : "outline"}
          className={variante === "primario" ? "h-12 w-full text-base" : "h-12 w-auto text-base"}
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

        {aviso !== null && (
          <p
            role="alert"
            className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
          >
            {aviso}
          </p>
        )}

        <fieldset className="flex flex-col gap-1">
          <legend className="text-tinta-fraca px-0 pb-1 text-xs tracking-wide uppercase">
            Nota
          </legend>
          {NOTAS.map((opcao) => {
            const id = `${grupoId}-${String(opcao.valor)}`;
            return (
              <label
                key={opcao.valor}
                htmlFor={id}
                className="border-linha flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  id={id}
                  name={grupoId}
                  value={opcao.valor}
                  disabled={enviando}
                  checked={nota === opcao.valor}
                  onChange={() => {
                    setNota(opcao.valor);
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
        </fieldset>

        <div className="flex flex-col gap-1.5">
          {/* **Sem aviso de visibilidade, e a ausência é decisão:** a restrição herdada nº 1 do inventário
              enumera *"modais que têm campo `observacao`"*, e este tem `comentario`. Inventar a frase aqui
              seria escrever texto de produto num componente. */}
          <label htmlFor={campoComentarioId} className="text-tinta text-sm font-medium">
            Comentário (opcional)
          </label>
          <textarea
            id={campoComentarioId}
            value={comentario}
            onChange={(evento) => {
              setComentario(evento.target.value);
            }}
            disabled={enviando}
            rows={3}
            /* **O mesmo teto do `avaliacaoSchema`** — 1000. Dois números divergiriam. */
            maxLength={1000}
            className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 py-2 text-base"
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11">
              Fechar
            </Button>
          </DialogClose>
          {/* **Desabilitado enquanto não há nota** — `nota` é `required` no schema, e habilitar produziria
              um `400` que a tela podia evitar. O comentário vazio não desabilita nada. */}
          <Button
            type="button"
            className="h-11"
            disabled={enviando || nota === null}
            onClick={() => void confirmar()}
          >
            {enviando ? "Enviando…" : "Enviar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
