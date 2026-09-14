"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { AVISO_DE_VISIBILIDADE } from "@/interface/componentes/rotulos";
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
import { Textarea } from "@/interface/componentes/ui/textarea";

/**
 * ============================================================================
 *  O modal parametrizado de `observacao` — e os DOIS comandos que ele serve
 * ============================================================================
 *
 * **Um componente parametrizado, não um por comando.** O modal de `iniciar-atendimento` (item 22) e o
 * de `retomar` (item 24) diferem em **três strings**: título, descrição e rótulo do gatilho — e a
 * partir do item 24 os dois existem, montados pela página com as mesmas **dez** props. Escrever dois
 * arquivos iguais seria a cópia de sempre — e a estrutura de `formularios` que o item 19 criou já aceita
 * qualquer nó pronto, sem a barra ganhar um `if`.
 *
 * **Nenhum tipo do Domínio entra aqui**, como na barra e no modal de atribuição: `comando` é `string`, os
 * rótulos chegam prontos, o mapa de status chega pronto. Importar `@/interface/projecoes` arrastaria
 * `comandosDisponiveis` — a máquina de estados inteira — para o pacote do navegador, que é literalmente a
 * segunda cópia que `acoesDisponiveis` existe para impedir.
 *
 * **O ciclo de repinte é o do `ModalDeAtribuicao`, e é herança deliberada:** repintar no erro desmontaria
 * o componente no exato caso em que a frase do `409` existe para ser lida. Então a frase fica visível
 * enquanto o modal está aberto, e **é o fechamento que repinta**. O sucesso passa pelo mesmo caminho.
 * *(É o furo F-2 que a revisão do item 19 fechou; herdar a correção é mais barato que redescobri-la.)*
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
}) {
  const router = useRouter();
  const campoId = useId();
  const avisoId = useId();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [precisaRepintar, setPrecisaRepintar] = useState(false);

  /** **O repinte acontece AO FECHAR, e nunca ao falhar.** Ver o bloco acima. */
  function aoMudarAbertura(proximo: boolean) {
    setAberto(proximo);

    if (proximo) {
      // Reabrir começa limpo: aviso velho ao lado de texto novo é a pior combinação possível — e
      // `precisaRepintar` volta a `false` para que abrir-e-fechar sem agir não custe uma ida ao servidor.
      setAviso(null);
      setTexto("");
      setPrecisaRepintar(false);
      return;
    }

    if (precisaRepintar) {
      setPrecisaRepintar(false);
      router.refresh();
    }
  }

  async function confirmar() {
    setEnviando(true);
    setAviso(null);

    // **A tela manda o que digitou, sem aparar.** Quem apara é o comando de aplicação, num lugar só — e é
    // ele que decide que vazio vira `null`. Aparar aqui também criaria a segunda regra.
    const resultado = await executarComando(
      ocorrenciaId,
      comando,
      { observacao: texto },
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

        {aviso !== null && (
          <p
            role="alert"
            className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
          >
            {aviso}
          </p>
        )}

        {/* **A marcação é própria, e NÃO reusa `Campo`**: ele renderiza a `ajuda` DEPOIS do children, e o
            critério 22.5 exige o aviso ANTES do campo. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={campoId} className="text-tinta text-sm font-medium">
            {rotuloDoCampo}
          </label>
          <p id={avisoId} className="text-tinta-suave text-xs leading-relaxed">
            {AVISO_DE_VISIBILIDADE}
          </p>
          <Textarea
            id={campoId}
            aria-describedby={avisoId}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            disabled={enviando}
            rows={3}
            /* **O mesmo teto do `comandoComObservacaoSchema`** — 1000. Dois números divergiriam. */
            maxLength={1000}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11">
              Fechar
            </Button>
          </DialogClose>
          {/* **Confirmar NÃO é desabilitado por campo vazio** — a `observacao` é opcional (D23: *"campo
              obrigatório em momento rotineiro é preenchido com 'ok' e o dado morre"*). */}
          <Button
            type="button"
            className="h-11"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? verboEnviando : rotuloDeConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
