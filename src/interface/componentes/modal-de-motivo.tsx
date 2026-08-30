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
import { DropdownMenuItem } from "@/interface/componentes/ui/dropdown-menu";

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
 *  O quarto modal — e o primeiro em que confirmar é DESABILITADO por campo vazio
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
 * **Confirmar desabilitado é decisão, e ela é o oposto da dos três modais anteriores — de propósito.**
 * `ModalDeObservacao` e `ModalDeResolucao` não desabilitam porque os campos deles são **opcionais**
 * (D23: *"campo obrigatório em momento rotineiro é preenchido com 'ok'"*). Aqui os dois são
 * obrigatórios por invariante, e o precedente do produto já existe: `ModalDeAtribuicao` desabilita com
 * `escolhido === null`. **Sem isso, o único caminho para a pessoa é um `400` que a tela poderia ter
 * evitado** — e `400` que a navegação normal alcança é defeito de tela.
 *
 * **O ciclo de repinte é o dos três anteriores, herdado e não redescoberto:** repintar no erro
 * desmontaria o componente no exato caso em que a frase do `409` existe para ser lida; **é o fechamento
 * que repinta**, e o sucesso passa pelo mesmo caminho. *(Furo F-2, fechado na revisão do item 19.)*
 *
 * **A quarta cópia desse ciclo fica de pé, e a decisão de não extrair está declarada** — achado A-3 da
 * spec: não há teste de componente neste projeto, e refatorar quatro componentes que funcionam sem uma
 * asserção que prove que continuam funcionando é trocar duplicação declarada por risco não medido.
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
   * > **O nome não é `aviso`, e a diferença não é estética:** `aviso` já é o estado local que carrega a
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
}) {
  const router = useRouter();
  const grupoId = useId();
  const campoId = useId();
  const avisoId = useId();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [precisaRepintar, setPrecisaRepintar] = useState(false);

  /** **O repinte acontece AO FECHAR, e nunca ao falhar.** Ver o bloco acima. */
  function aoMudarAbertura(proximo: boolean) {
    setAberto(proximo);

    if (proximo) {
      // Reabrir começa limpo: aviso velho ao lado de escolha nova é a pior combinação possível — e
      // `precisaRepintar` volta a `false` para que abrir-e-fechar sem agir não custe uma ida ao
      // servidor.
      setAviso(null);
      setEscolhido(null);
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
    if (escolhido === null || texto.trim() === "") return;
    setEnviando(true);
    setAviso(null);

    // **A tela manda o que digitou, sem aparar.** Quem apara é o comando de aplicação, num lugar só.
    const resultado = await executarComando(
      ocorrenciaId,
      comando,
      { motivo: escolhido, observacao: texto },
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
        variant={variante === "primario" ? "default" : "outline"}
        /* **A largura vem da variante, não do *shrink-to-fit*** — é `.actionbar .btn.ghost
           { width: auto }` do protótipo, e dispensa apostar em como o navegador resolve `w-full`
           dentro de um invólucro `flex-none`. */
        className={variante === "primario" ? "h-12 w-full text-base" : "h-12 w-auto text-base"}
      >
        {rotuloDoGatilho}
      </Button>
    );

  const podeConfirmar = escolhido !== null && texto.trim() !== "" && !enviando;

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAbertura}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>

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

        <fieldset className="flex flex-col gap-1">
          <legend className="text-tinta-fraca px-0 pb-1 text-xs tracking-wide uppercase">
            {rotuloDoGrupo}
          </legend>
          {motivos.map((motivo) => {
            const id = `${grupoId}-${motivo.valor}`;
            return (
              <label
                key={motivo.valor}
                htmlFor={id}
                /* **`items-start` só quando há descrição**, para o rádio alinhar com a PRIMEIRA linha em
                   vez de centralizar num bloco de duas. `min-h-11` continua nos dois casos, e o alvo de
                   toque cresce em vez de encolher (A-3). */
                className={`border-linha flex min-h-11 cursor-pointer gap-3 rounded-md border px-3 text-sm ${
                  motivo.descricao === undefined ? "items-center py-2" : "items-start py-2.5"
                }`}
              >
                {/* **A-1:** rótulo associado ao controle — clicar no texto seleciona. */}
                <input
                  type="radio"
                  id={id}
                  name={grupoId}
                  value={motivo.valor}
                  disabled={enviando}
                  checked={escolhido === motivo.valor}
                  onChange={() => setEscolhido(motivo.valor)}
                  className="mt-0.5 size-4"
                />
                {/* **A descrição vai DENTRO do `<label>`, e não em `aria-describedby`**: o nome
                    acessível da opção já a inclui, e uma descrição ancorada separadamente a leria duas
                    vezes (A-1). */}
                <span className="flex flex-col gap-0.5">
                  <span className="text-tinta">{motivo.rotulo}</span>
                  {motivo.descricao !== undefined && (
                    <span className="text-tinta-suave text-xs leading-relaxed">
                      {motivo.descricao}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>

        {/* **A marcação é própria, e NÃO reusa `Campo`**: ele renderiza a ajuda DEPOIS do children, e o
            aviso tem de vir ANTES do campo. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={campoId} className="text-tinta text-sm font-medium">
            Observação
          </label>
          <p id={avisoId} className="text-tinta-suave text-xs leading-relaxed">
            {avisoDeVisibilidade}
          </p>
          <textarea
            id={campoId}
            aria-describedby={avisoId}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            disabled={enviando}
            rows={3}
            /* **O mesmo teto do `pausaSchema`** — 1000. Dois números divergiriam. */
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
          {/* **Desabilitado enquanto falta motivo OU observação** — os dois são obrigatórios por
              invariante, e sem isto o único caminho da pessoa seria um `400` que a tela podia evitar. */}
          <Button
            type="button"
            className="h-11"
            disabled={!podeConfirmar}
            onClick={() => void confirmar()}
          >
            {enviando ? verboEnviando : rotuloDeConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
