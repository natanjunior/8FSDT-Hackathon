"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  filtrarPorNome,
  repartirCandidatos,
  termosDaBusca,
  type Candidato,
} from "@/interface/componentes/busca-de-candidatos";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { palavrasDaAtribuicao } from "@/interface/componentes/rotulos";
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
import { Input } from "@/interface/componentes/ui/input";

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
 * porque o primeiro bloco tem tamanho de dígito único em ambos.
 *
 * **A fileira *"Atribuir a mim"* é o critério 20.5**, e ela vem antes dos dois blocos: quem chama sai
 * deles (`repartirCandidatos`) para que não haja dois controles enviando o mesmo `pessoaId`. **O campo de
 * busca é o critério 20.6.**
 */

const NOME_DO_BLOCO = {
  executores: "Gestores e Encarregados",
  solicitantes: "Solicitantes",
} as const;

export function ModalDeAtribuicao({
  ocorrenciaId,
  candidatos,
  euPessoaId,
  responsavelAtualPessoaId,
  rotulosDeStatus,
  organizacaoId,
  variante,
}: {
  ocorrenciaId: string;
  /** Já ordenados por nome pelo repositório — `order by p.nome`, a mesma ordem de T-08. */
  candidatos: readonly Candidato[];
  /**
   * **Quem está olhando.** É o `escopo.ctx.pessoaId` da página, e serve à fileira *"Atribuir a mim"*
   * (critério 20.5): ela mostra o próprio nome, e quem chama **sai dos dois blocos** para que não existam
   * dois controles enviando o mesmo `pessoaId`.
   */
  euPessoaId: string;
  /** Marcado *"Responsável atual"* e **não selecionável** — reatribuir para a mesma pessoa produziria uma
   *  linha nova e nada visível mudando na tela. */
  responsavelAtualPessoaId: string | null;
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /**
   * **Três variantes desde o item 23:** `"menu"` renderiza o gatilho como `DropdownMenuItem`, porque
   * em `em_analise` com responsável e em `em_atendimento` a atribuição vai para o *"Mais ações ▾"*.
   * Botão nu dentro do `DropdownMenuContent` é ARIA inválida e o menu perde a navegação por setas.
   */
  variante: "primario" | "secundario" | "menu";
}) {
  const router = useRouter();
  const campoDeBuscaId = useId();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
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
      setBusca("");
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
      organizacaoId,
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

  const { eu, executores, solicitantes } = repartirCandidatos(candidatos, euPessoaId);

  /** **A-5:** o estado vai em palavra, e o `opacity-60` é reforço — nunca o sinal. */
  const euSouOResponsavel = eu !== null && eu.pessoaId === responsavelAtualPessoaId;

  /**
   * **A palavra sai do ESTADO, e é o critério 21.1 na tela** — *"a distinção é derivada do estado, não da
   * intenção do cliente"*. Quem decide é o modal, e não a página: ele já recebe
   * `responsavelAtualPessoaId`, e mandar cinco strings por prop moveria para o servidor um fato que o
   * cliente tem em mãos.
   *
   * **É `!== null`, não *"está na lista"*** — ver o docblock de `palavrasDaAtribuicao`.
   */
  const palavras = palavrasDaAtribuicao(responsavelAtualPessoaId !== null);

  /**
   * **Reparte PRIMEIRO, filtra depois — e nunca o contrário.** Filtrar antes de repartir apagaria a
   * fileira *"Atribuir a mim"* sempre que o texto digitado não casasse o nome de quem está olhando, que é
   * o que a §3.7 da spec proíbe em uma frase.
   */
  const executoresVisiveis = filtrarPorNome(executores, busca);
  const solicitantesVisiveis = filtrarPorNome(solicitantes, busca);

  /**
   * **A frase do vazio só existe com busca digitada.** Sem esta condição ela apareceria numa organização
   * cujo único detentor de `vinculo.gerir` é quem chama — os dois blocos vazios **sem ninguém ter
   * buscado** —, e dizer ali *"Ninguém com esse nome"* é a frase errada no lugar errado.
   */
  const buscando = termosDaBusca(busca).length > 0;
  const nadaEncontrado =
    buscando && executoresVisiveis.length === 0 && solicitantesVisiveis.length === 0;

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

  /**
   * **Seleção que o filtro esconde é APAGADA, não guardada.**
   *
   * Sem isto o rodapé ficaria habilitado enviando alguém que a tela não mostra — a forma mais silenciosa
   * de gravar a pessoa errada.
   *
   * **A fileira *"Atribuir a mim"* sobrevive a qualquer texto**, porque ela não é filtrada (§3.7): se o
   * escolhido for quem chama, não há o que reconferir.
   */
  function aoBuscar(texto: string) {
    setBusca(texto);

    if (escolhido === null || (eu !== null && escolhido === eu.pessoaId)) return;

    const continuaVisivel =
      filtrarPorNome(executores, texto).some((pessoa) => pessoa.pessoaId === escolhido) ||
      filtrarPorNome(solicitantes, texto).some((pessoa) => pessoa.pessoaId === escolhido);

    if (!continuaVisivel) setEscolhido(null);
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
            {palavras.gatilho}
          </DropdownMenuItem>
        ) : (
          <Button
            type="button"
            variant={variante === "primario" ? "marca" : "outline"}
            /* **A largura vem da variante desde o item 22** — o invólucro do secundário é `flex-none`,
               e `w-auto` é `.actionbar .btn.ghost { width: auto }` do protótipo. */
            className={
              variante === "primario" ? "h-12 w-full text-base" : "h-12 w-auto text-base lg:w-full"
            }
          >
            {palavras.gatilho}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{palavras.titulo}</DialogTitle>
          <DialogDescription>{palavras.descricao}</DialogDescription>
        </DialogHeader>

        {aviso !== null && (
          <p
            role="alert"
            className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
          >
            {aviso}
          </p>
        )}

        {/*
          **A primeira linha do modal, e o critério 20.5.** É uma opção de escolha única — mesmo
          `name="responsavel"`, mesmo estado `escolhido`, confirmada pelo mesmo botão do rodapé.
          **Não grava no toque**, e a razão é dupla: o `inventario-de-telas.md:786` a descreve como item de
          FORMULÁRIO, e a atribuição aparece na linha do tempo do Solicitante (19.4) sem ter desfazer.

          **Fora dos dois `fieldset`, e isso não separa o grupo:** rádio agrupa por `name`, não por
          `fieldset`. Escolhê-la **desmarca** qualquer candidato, e vice-versa.

          **Não é filtrada pela busca (§3.7)** — se a busca a escondesse, o caso que o 20.5 existe para
          dispensar da busca voltaria a depender dela.
        */}
        {eu !== null && (
          <label
            htmlFor={`candidato-${eu.pessoaId}`}
            className={`border-linha flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm ${
              euSouOResponsavel ? "opacity-60" : "cursor-pointer"
            }`}
          >
            <input
              type="radio"
              id={`candidato-${eu.pessoaId}`}
              name="responsavel"
              value={eu.pessoaId}
              disabled={euSouOResponsavel || enviando}
              checked={escolhido === eu.pessoaId}
              onChange={() => setEscolhido(eu.pessoaId)}
              className="size-4"
            />
            <span className="flex flex-col">
              {/* Verbo no imperativo — é como se escreve botão. */}
              <span className="text-tinta font-medium">Atribuir a mim</span>
              {/* A sub-linha faz a fileira PARECER o que ela é, e diz ao Gestor de três organizações em
                  qual identidade ele está prestes a se atribuir. */}
              <span className="text-tinta-suave text-xs">
                {eu.nome} · {eu.papel}
                {eu.area !== null && ` · ${eu.area}`}
                {euSouOResponsavel && " · Responsável atual"}
              </span>
            </span>
          </label>
        )}

        {/*
          **O campo fica ABAIXO da fileira e ACIMA dos blocos, e é deliberado:** ele encosta exatamente no
          que filtra. Pô-lo no topo diria, pela posição, que filtra a fileira também — e não filtra (§3.7).

          **Sempre visível.** O critério 20.6 diz *"o modal **tem** um campo de busca"*, sem condição — um
          campo que aparecesse acima de N candidatos faria o mesmo modal ter duas formas conforme a
          organização, e nenhuma tela do produto pratica isso.

          **Sem foco automático (§3.10):** um campo com busca abre o teclado, e num modal que na maior parte
          das aberturas é resolvido pela primeira fileira isso cobre a lista com metade da tela para nada.
        */}
        <div className="flex flex-col gap-1.5">
          {/* **A-1:** rótulo visível e associado. `placeholder` nunca é rótulo. */}
          <label htmlFor={campoDeBuscaId} className="text-tinta text-sm font-medium">
            Buscar pelo nome
          </label>
          <Input
            id={campoDeBuscaId}
            type="search"
            inputMode="search"
            autoComplete="off"
            /* O teto da coluna e do schema (`schemas/vinculo.ts`), para que um nome inteiro caiba. */
            maxLength={120}
            value={busca}
            onChange={(evento) => aoBuscar(evento.currentTarget.value)}
            disabled={enviando}
            /* **A-3:** o catálogo entrega `h-9`; os modais sobem para ~44 px. */
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-4">
          {bloco(NOME_DO_BLOCO.executores, executoresVisiveis)}
          {bloco(NOME_DO_BLOCO.solicitantes, solicitantesVisiveis)}

          {/*
            **Frase própria, diferente de qualquer outra do produto** — é a regra que o
            `inventario-de-telas.md:619` escreve para T-03: trocar uma pela outra faz o Gestor pensar que
            perdeu dados.

            **Texto simples, não região viva:** um `role="status"` que fala a cada tecla é ruído para quem
            usa leitor de tela, e a lista está imediatamente abaixo do campo.

            **Sem botão de limpar:** o campo está a um dedo e tem o `×` nativo do `type="search"`.
          */}
          {nadaEncontrado && <p className="text-tinta-suave text-sm">Ninguém com esse nome.</p>}
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
            {enviando ? palavras.enviando : palavras.confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
