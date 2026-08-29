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
 * **O ciclo de repinte é o do `ModalDeObservacao`, herdado e não redescoberto:** repintar no erro
 * desmontaria o componente no exato caso em que a frase do `409` existe para ser lida; **é o fechamento
 * que repinta**, e o sucesso passa pelo mesmo caminho. *(Furo F-2, fechado na revisão do item 19.)*
 * **É a terceira cópia desse ciclo, e está declarada** — a extração é do item 23, com cinco casos na mão.
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
}: {
  ocorrenciaId: string;
  /**
   * A solução já gravada, para o campo abrir pré-preenchido.
   *
   * **Desde o item 25 ela tem valor de verdade:** o campo no corpo de T-05 escreve a coluna, e o modal a
   * lê. Ela também é a referência de `solucaoMudou`, em `confirmar` — é o que impede o modal de reenviar
   * texto que ninguém digitou.
   */
  solucaoAplicadaAtual: string | null;
  variante: "primario" | "secundario";
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const campoSolucaoId = useId();
  const campoObservacaoId = useId();
  const avisoId = useId();
  const [aberto, setAberto] = useState(false);
  const [solucao, setSolucao] = useState(solucaoAplicadaAtual ?? "");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [precisaRepintar, setPrecisaRepintar] = useState(false);

  /** **O repinte acontece AO FECHAR, e nunca ao falhar.** Ver o bloco acima. */
  function aoMudarAbertura(proximo: boolean) {
    setAberto(proximo);

    if (proximo) {
      // Reabrir começa limpo — aviso velho ao lado de texto novo é a pior combinação possível. **Mas a
      // solução volta ao que está GRAVADO**, e não a vazio: o campo é pré-preenchido, não rascunho.
      setAviso(null);
      setSolucao(solucaoAplicadaAtual ?? "");
      setObservacao("");
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
    const resultado = await executarComando(ocorrenciaId, "resolver", corpo, rotulosDeStatus);

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
          /* **A largura vem da variante, não do *shrink-to-fit*** — a geometria que o item 22 firmou. */
          className={variante === "primario" ? "h-12 w-full text-base" : "h-12 w-auto text-base"}
        >
          Resolver
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resolver</DialogTitle>
          {/* **Os dois fatos do estado terminal, e é a única frase nova de produto desta fatia.** Ela
              está declarada no achado A-3 da spec para o hub confirmar ou trocar; trocá-la não muda uma
              linha de estrutura. */}
          <DialogDescription>A ocorrência será encerrada. Não há como reabrir.</DialogDescription>
        </DialogHeader>

        {aviso !== null && (
          <p
            role="alert"
            className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
          >
            {aviso}
          </p>
        )}

        {/* **PRIMEIRO campo, em foco.** É a indução da D22, e é o único mecanismo que existe até o
            interruptor por organização nascer. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={campoSolucaoId} className="text-tinta text-sm font-medium">
            O que foi feito (opcional)
          </label>
          <textarea
            id={campoSolucaoId}
            autoFocus
            value={solucao}
            onChange={(evento) => setSolucao(evento.target.value)}
            disabled={enviando}
            rows={4}
            /* **O mesmo teto do `resolucaoSchema`** — 4000. Dois números divergiriam. */
            maxLength={4000}
            className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 py-2 text-base"
          />
        </div>

        {/* **SEGUNDO campo**, com o aviso ANTES dele — a restrição herdada nº 1. A marcação é própria e
            NÃO reusa `Campo`: ele renderiza a ajuda DEPOIS do children. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={campoObservacaoId} className="text-tinta text-sm font-medium">
            Observação (opcional)
          </label>
          <p id={avisoId} className="text-tinta-suave text-xs leading-relaxed">
            {AVISO_DE_VISIBILIDADE}
          </p>
          <textarea
            id={campoObservacaoId}
            aria-describedby={avisoId}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            disabled={enviando}
            rows={3}
            /* **O mesmo teto do campo `observacao` do módulo de schemas** — 1000. */
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
          {/* **Confirmar NÃO é desabilitado por campo vazio** — os dois são opcionais (D23, e o critério
              25.4: resolver sem solução responde `200`). A indução é o foco, nunca a trava. */}
          <Button
            type="button"
            className="h-11"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? "Resolvendo…" : "Resolver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
