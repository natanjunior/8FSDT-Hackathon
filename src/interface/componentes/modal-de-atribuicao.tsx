"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
 * ============================================================================
 *  O modal de atribuição — o primeiro do produto
 * ============================================================================
 *
 * **A projeção é estreita, e não é economia de bytes.** `VinculoLido` carrega `contatos[]`, que é dado
 * pessoal sob o RNF10 e a razão de `GET /vinculos` exigir `vinculo.gerir`; descer o objeto inteiro por
 * prop mandaria o telefone de todo mundo para o navegador de quem só ia escolher um nome.
 *
 * **Todos os vínculos ativos entram, e nenhum papel é excluído** — `contrato-de-api.md` fixa em letra que
 * *"a lista de candidatos é literalmente a lista de vínculos ativos"*. O agrupamento **ordena sem
 * excluir**: a D21 protege a possibilidade de qualquer vínculo ser responsável, não a afirmação de que
 * todos são igualmente prováveis.
 *
 * **Dois blocos, e a razão é a escala declarada.** O RNF3 mede **200 pessoas por organização** e a Persona
 * 1A tem *"cerca de 10 apartamentos"* — a lista real vai de ~13 a 200. Num condomínio grande o Encarregado
 * é um ou dois entre ~197 moradores; com dois blocos, o caso comum fica no topo nos **dois** extremos,
 * porque o primeiro bloco tem tamanho de dígito único em ambos. **O campo de busca é o item 20**,
 * critério 20.6. **A linha *"Atribuir a mim"* também é o 20**, critério 20.5.
 */
export type Candidato = {
  pessoaId: string;
  nome: string;
  /** Em palavra, montado no servidor — o navegador não monta rótulo (A-5). */
  papel: string;
  /** A unidade, quando houver. É o que desempata homônimos. */
  area: string | null;
};

const NOME_DO_BLOCO = {
  executores: "Gestores e Encarregados",
  solicitantes: "Solicitantes",
} as const;

export function ModalDeAtribuicao({
  ocorrenciaId,
  candidatos,
  responsavelAtualPessoaId,
  rotulosDeStatus,
  variante,
}: {
  ocorrenciaId: string;
  /** Já ordenados por nome pelo repositório — `order by p.nome`, a mesma ordem de T-08. */
  candidatos: readonly Candidato[];
  /** Marcado *"Responsável atual"* e **não selecionável** — reatribuir para a mesma pessoa produziria uma
   *  linha nova e nada visível mudando na tela. */
  responsavelAtualPessoaId: string | null;
  rotulosDeStatus: Readonly<Record<string, string>>;
  /**
   * **Três variantes desde o item 23:** `"menu"` renderiza o gatilho como `DropdownMenuItem`, porque
   * em `em_analise` com responsável e em `em_atendimento` a atribuição vai para o *"Mais ações ▾"*.
   * Botão nu dentro do `DropdownMenuContent` é ARIA inválida e o menu perde a navegação por setas.
   */
  variante: "primario" | "secundario" | "menu";
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [precisaRepintar, setPrecisaRepintar] = useState(false);

  /**
   * **O repinte acontece AO FECHAR, e nunca ao falhar.**
   *
   * Repintar no erro desmontaria este componente no exato caso em que a frase existe para ser lida: depois
   * de um `409`, `atribuir-responsavel` saiu de `acoesDisponiveis`, a página deixa de passar este nó, e o
   * `useState` do aviso vai junto. **É o mesmo defeito que a revisão do item 16 encontrou na barra** — lá
   * a correção foi manter o componente montado; aqui não dá, porque a existência dele *é* o que muda.
   *
   * Então: a frase fica visível enquanto o modal está aberto, sem repinte nenhum; quem lê fecha — pelo
   * *Fechar*, por `Esc` ou por clique fora, e os três passam por aqui —, e é o fechamento que repinta.
   * O sucesso é o mesmo caminho.
   */
  function aoMudarAbertura(proximo: boolean) {
    setAberto(proximo);

    if (proximo) {
      // Reabrir começa limpo: aviso velho ao lado de escolha nova é a pior combinação possível — e
      // `precisaRepintar` volta a `false` para que abrir-e-fechar sem agir não custe uma ida ao servidor.
      setAviso(null);
      setEscolhido(null);
      setPrecisaRepintar(false);
      return;
    }

    if (precisaRepintar) {
      setPrecisaRepintar(false);
      router.refresh();
    }
  }

  async function confirmar() {
    if (escolhido === null) return;
    setEnviando(true);
    setAviso(null);

    const resultado = await executarComando(
      ocorrenciaId,
      "atribuir-responsavel",
      // **`observacao` NUNCA é enviada** — o servidor a recusa com `422 CAMPO_NAO_SUPORTADO` (critério
      // 19.6), e não há campo na tela que a produza.
      { responsavelPessoaId: escolhido },
      rotulosDeStatus,
    );

    setEnviando(false);
    setPrecisaRepintar(true);

    if (resultado.ok) {
      aoMudarAbertura(false);
      // `precisaRepintar` ainda não valia quando `aoMudarAbertura` leu o estado — o React agenda. Repinta
      // aqui, explicitamente, no caminho de sucesso.
      router.refresh();
      return;
    }

    setAviso(resultado.aviso);
  }

  const executores = candidatos.filter((pessoa) => pessoa.papel !== "Solicitante");
  const solicitantes = candidatos.filter((pessoa) => pessoa.papel === "Solicitante");

  function bloco(titulo: string, lista: readonly Candidato[]) {
    // **Bloco vazio não renderiza** — um subtítulo sozinho pergunta o que aconteceu com a lista.
    if (lista.length === 0) return null;

    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="text-tinta-fraca px-0 pb-1 text-xs tracking-wide uppercase">
          {titulo}
        </legend>
        {lista.map((pessoa) => {
          const atual = pessoa.pessoaId === responsavelAtualPessoaId;
          const id = `candidato-${pessoa.pessoaId}`;

          return (
            <label
              key={pessoa.pessoaId}
              htmlFor={id}
              className={`border-linha flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                atual ? "opacity-60" : "cursor-pointer"
              }`}
            >
              {/* **A-1:** rótulo associado ao controle — clicar no nome seleciona. */}
              <input
                type="radio"
                id={id}
                name="responsavel"
                value={pessoa.pessoaId}
                disabled={atual || enviando}
                checked={escolhido === pessoa.pessoaId}
                onChange={() => setEscolhido(pessoa.pessoaId)}
                className="size-4"
              />
              <span className="flex flex-col">
                {/* **Nome por extenso** — abreviar não está autorizado em documento nenhum (R-12). */}
                <span className="text-tinta font-medium">{pessoa.nome}</span>
                <span className="text-tinta-suave text-xs">
                  {pessoa.papel}
                  {pessoa.area !== null && ` · ${pessoa.area}`}
                  {/* **A-5:** o estado vai em palavra, nunca só em cor. */}
                  {atual && " · Responsável atual"}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAbertura}>
      <DialogTrigger asChild>
        {variante === "menu" ? (
          /* **`onSelect` prevenido:** `DropdownMenuContent` desmonta os filhos ao fechar, e selecionar
             um item fecha o menu por padrão — o `Dialog` morreria no instante em que deveria abrir.
             Custo declarado: o menu fica aberto atrás do diálogo. */
          <DropdownMenuItem
            className="min-h-11"
            onSelect={(evento) => {
              evento.preventDefault();
            }}
          >
            Atribuir
          </DropdownMenuItem>
        ) : (
          <Button
            type="button"
            variant={variante === "primario" ? "default" : "outline"}
            /* **A largura vem da variante desde o item 22** — o invólucro do secundário é `flex-none`,
               e `w-auto` é `.actionbar .btn.ghost { width: auto }` do protótipo. */
            className={variante === "primario" ? "h-12 w-full text-base" : "h-12 w-auto text-base"}
          >
            Atribuir
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atribuir responsável</DialogTitle>
          <DialogDescription>Quem vai cuidar desta ocorrência.</DialogDescription>
        </DialogHeader>

        {aviso !== null && (
          <p
            role="alert"
            className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
          >
            {aviso}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {bloco(NOME_DO_BLOCO.executores, executores)}
          {bloco(NOME_DO_BLOCO.solicitantes, solicitantes)}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11">
              Fechar
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="h-11"
            disabled={escolhido === null || enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? "Atribuindo…" : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
