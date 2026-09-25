"use client";

import { Check } from "lucide-react";
import { useId, useState } from "react";

import {
  filtrarPorNome,
  repartirCandidatos,
  termosDaBusca,
  type Candidato,
} from "@/interface/componentes/busca-de-candidatos";
import { ErroDoFormulario, GrupoDeEscolha } from "@/interface/componentes/campo";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import { palavrasDaAtribuicao } from "@/interface/componentes/rotulos";
import { Button } from "@/interface/componentes/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/interface/componentes/ui/command";
import { DropdownMenuItem } from "@/interface/componentes/ui/dropdown-menu";
import { useEnvioDoModal } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

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
 *
 * **O envio segue a sequência de modal do guia §7**, pelo `useEnvioDoModal` (item 44g): carregando no
 * modal, que não fecha durante o envio; sucesso com aviso, modal fechado e página atualizada; erro com
 * aviso e mensagem no modal aberto, e o fechamento depois de um erro atualiza a página. **O botão
 * principal só fica inerte durante o envio**: clicado com campo obrigatório vazio, ele mostra os erros e
 * leva o foco ao primeiro (guia §7, decidido em 16/09/2026).
 *
 * **Desde o item 66 os dois blocos são `command`, e a fileira de cima continua rádio, fora dele.**
 */

const NOME_DO_BLOCO = {
  executores: "Gestores e Encarregados",
  solicitantes: "Solicitantes",
} as const;

/**
 * **O título de cada grupo, no papel de rótulo** (critério 44q.12), agora no cabeçalho do `cmdk`. E o vão
 * entre os candidatos, que o `cmdk` não dá.
 */
const CLASSE_DO_GRUPO =
  "p-0 [&_[cmdk-group-heading]]:text-tinta-fraca [&_[cmdk-group-heading]]:text-rotulo-coluna [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-1";

const CLASSE_DO_CANDIDATO =
  "border-linha group-data-invalido:border-destructive/[75%] text-interface flex min-h-11 items-center gap-3 rounded-md border px-3 py-2";

/** O campo do `cmdk` com a borda e a altura dos campos do produto (A-3). */
const CLASSE_DA_BUSCA =
  "bg-transparent [&_[data-slot=command-input-wrapper]]:border-linha [&_[data-slot=command-input-wrapper]]:h-11 [&_[data-slot=command-input-wrapper]]:rounded-sm [&_[data-slot=command-input-wrapper]]:border";

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
  const grupoId = useId();
  const buscaId = useId();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  /**
   * **A palavra sai do ESTADO, e é o critério 21.1 na tela** — *"a distinção é derivada do estado, não da
   * intenção do cliente"*. Quem decide é o modal, e não a página: ele já recebe
   * `responsavelAtualPessoaId`, e mandar cinco strings por prop moveria para o servidor um fato que o
   * cliente tem em mãos.
   *
   * **É `!== null`, não *"está na lista"*** — ver o docblock de `palavrasDaAtribuicao`.
   */
  const palavras = palavrasDaAtribuicao(responsavelAtualPessoaId !== null);

  const formulario = useFormularioTocado({
    // **O foco do erro vai para a busca** (spec §3.9). O `cmdk` impõe o `id` do campo, então o alvo é o
    // invólucro, e `focar` desce até o primeiro campo livre dele.
    campos: { responsavel: buscaId },
    erros: { responsavel: escolhido === null ? "Escolha o responsável." : undefined },
  });

  const envio = useEnvioDoModal({
    enviar: () =>
      executarComando(
        ocorrenciaId,
        "atribuir-responsavel",
        // **`observacao` NUNCA é enviada** — o servidor a recusa com `422 CAMPO_NAO_SUPORTADO`
        // (critério 19.6), e não há campo na tela que a produza.
        { responsavelPessoaId: escolhido },
        rotulosDeStatus,
        organizacaoId,
      ),
    aoConcluir: () => ({ titulo: palavras.sucesso }),
    tituloDaFalha: palavras.falha,
    aoAbrir: () => {
      setEscolhido(null);
      setBusca("");
      formulario.recomecar();
    },
  });

  function confirmar() {
    if (formulario.tentarEnviar()) void envio.confirmar();
  }

  function escolher(pessoaId: string) {
    setEscolhido(pessoaId);
    formulario.mudou("responsavel");
  }

  const { eu, executores, solicitantes } = repartirCandidatos(candidatos, euPessoaId);

  /** **A-5:** o estado vai em palavra, e o `opacity-60` é reforço — nunca o sinal. */
  const euSouOResponsavel = eu !== null && eu.pessoaId === responsavelAtualPessoaId;

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

  function grupo(titulo: string, lista: readonly Candidato[]) {
    // **Grupo vazio não renderiza** — um título sozinho pergunta o que aconteceu com a lista.
    if (lista.length === 0) return null;

    return (
      <CommandGroup heading={titulo} className={CLASSE_DO_GRUPO}>
        {lista.map((pessoa) => {
          const atual = pessoa.pessoaId === responsavelAtualPessoaId;
          const escolhida = escolhido === pessoa.pessoaId;

          return (
            /* **Escolher não grava** — marca a pessoa, e quem grava é o botão do rodapé. `aria-checked` diz
               *escolhida*; o `aria-selected` do `cmdk` quer dizer *realçada*, que é outra coisa. **A-5:** a
               escolha também vai em palavra e em ícone. */
            <CommandItem
              key={pessoa.pessoaId}
              value={pessoa.pessoaId}
              disabled={atual || envio.enviando}
              aria-checked={escolhida}
              onSelect={() => {
                escolher(pessoa.pessoaId);
              }}
              className={CLASSE_DO_CANDIDATO}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                {/* **Nome por extenso** — abreviar não está autorizado em documento nenhum (R-12). */}
                <span className="text-tinta font-medium">{pessoa.nome}</span>
                <span className="text-tinta-suave text-meta">
                  {pessoa.papel}
                  {pessoa.area !== null && ` · ${pessoa.area}`}
                  {atual && " · Responsável atual"}
                  {escolhida && " · Sua escolha"}
                </span>
              </span>
              {escolhida && <Check aria-hidden="true" className="text-marca size-4 shrink-0" />}
            </CommandItem>
          );
        })}
      </CommandGroup>
    );
  }

  /**
   * **Seleção que o filtro esconde é APAGADA, não guardada.**
   *
   * Sem isto o rodapé enviaria alguém que a tela não mostra — a forma mais silenciosa de gravar a pessoa
   * errada.
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
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      gatilho={
        variante === "menu" ? (
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
              variante === "primario" ? "text-interface h-12 w-full" : "text-interface h-12 w-auto lg:w-full"
            }
          >
            {palavras.gatilho}
          </Button>
        )
      }
      titulo={palavras.titulo}
      descricao={palavras.descricao}
      /* **Só o grupo *Responsável* é campo de formulário**, e ele é obrigatório: a busca é ferramenta
         de achar, não campo (critério 44p.11). */
      obrigatorios={1}
      todosObrigatorios
      aoEnviar={(evento) => {
        evento.preventDefault();
        confirmar();
      }}
      rodape={
        <>
          <BotaoDeCancelar enviando={envio.enviando} />
          <BotaoDeConfirmar
            enviando={envio.enviando}
            rotulo={palavras.confirmar}
            rotuloEnviando={palavras.enviando}
          />
        </>
      }
    >
      <GrupoDeEscolha
        id={grupoId}
        legenda="Responsável"
        obrigatorio
        aoSair={formulario.aoSair("responsavel")}
        erro={formulario.erroDe("responsavel")}
      >
        {/*
          **A primeira linha do modal, e o critério 20.5.** É uma opção de escolha única — mesmo
          `name="responsavel"`, mesmo estado `escolhido`, confirmada pelo mesmo botão do rodapé.
          **Não grava no toque**, e a razão é dupla: o `inventario-de-telas.md:786` a descreve como item de
          FORMULÁRIO, e a atribuição aparece na linha do tempo do Solicitante (19.4) sem ter desfazer.

          **Fora do `Command` dos grupos desde o item 66, e isso não separa o grupo:** ela continua o
          rádio que era, e o estado `escolhido` é um só. Escolhê-la **desmarca** qualquer candidato, e
          vice-versa.

          **Não é filtrada pela busca (§3.7)** — se a busca a escondesse, o caso que o 20.5 existe para
          dispensar da busca voltaria a depender dela.
        */}
        {eu !== null && (
          <label
            htmlFor={`candidato-${eu.pessoaId}`}
            className={`border-linha group-data-invalido:border-destructive/[75%] text-interface flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 ${
              euSouOResponsavel ? "opacity-60" : "cursor-pointer"
            }`}
          >
            <input
              type="radio"
              id={`candidato-${eu.pessoaId}`}
              name="responsavel"
              value={eu.pessoaId}
              required
              disabled={euSouOResponsavel || envio.enviando}
              checked={escolhido === eu.pessoaId}
              onChange={() => escolher(eu.pessoaId)}
              className="size-4"
            />
            <span className="flex flex-col">
              {/* Verbo no imperativo — é como se escreve botão. */}
              <span className="text-tinta font-medium">Atribuir a mim</span>
              {/* A sub-linha faz a fileira PARECER o que ela é, e diz ao Gestor de três organizações em
                  qual identidade ele está prestes a se atribuir. */}
              <span className="text-tinta-suave text-meta">
                {eu.nome} · {eu.papel}
                {eu.area !== null && ` · ${eu.area}`}
                {euSouOResponsavel && " · Responsável atual"}
              </span>
            </span>
          </label>
        )}

        {/*
          **O campo fica ABAIXO da fileira e ACIMA dos grupos, e é deliberado:** ele encosta no que filtra.
          **Sempre visível** (critério 20.6) e **sem foco automático** (§3.10 da spec do 20).

          **A busca é a nossa, e a do `cmdk` fica desligada** (`shouldFilter={false}`), como no seletor de
          área: `filtrarPorNome` é prefixo de palavra, sem acento e sem caixa, e é ela que deixa a fileira
          de cima fora do filtro. **`Enter` no campo escolhe o candidato realçado e não envia o formulário**
          — o `cmdk` previne o `Enter`.

          **O rótulo visível é `aria-hidden`, e o nome acessível vem do `label` do `Command`:** o `cmdk`
          impõe `id` e `aria-labelledby` ao campo, então um rótulo associado por `htmlFor` não o alcançaria.
        */}
        <div id={buscaId} className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-tinta text-interface font-medium">
            Buscar pelo nome
          </span>
          <Command shouldFilter={false} label="Buscar pelo nome" className={CLASSE_DA_BUSCA}>
            <CommandInput
              value={busca}
              onValueChange={aoBuscar}
              disabled={envio.enviando}
              /* O teto da coluna e do schema (`schemas/vinculo.ts`), para que um nome inteiro caiba. */
              maxLength={120}
              className="text-tinta h-11"
            />
            {/* **Sem teto próprio de altura**: quem rola é o corpo do modal (item 68a). **O vão entre os
                grupos vai no `cmdk-list-sizer`**, o invólucro que o `cmdk` põe entre a lista e os grupos:
                na própria lista ele não alcançaria filho nenhum. **O `label` da lista é obrigatório**: sem
                ele o `cmdk` nomeia o `listbox` de *"Suggestions"*, em inglês. */}
            <CommandList
              label="Pessoas"
              className="mt-3 max-h-none overflow-visible [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-col [&_[cmdk-list-sizer]]:gap-4"
            >
              {grupo(NOME_DO_BLOCO.executores, executoresVisiveis)}
              {grupo(NOME_DO_BLOCO.solicitantes, solicitantesVisiveis)}
            </CommandList>
            {/* **Frase própria, diferente de qualquer outra do produto** — trocar uma pela outra faz o
                Gestor pensar que perdeu dados. Texto simples, não região viva, e **fora do `listbox`**:
                dentro dele só cabem opção e grupo. Não é o `CommandEmpty`, que apareceria também sem
                busca digitada, que é o caso que `nadaEncontrado` existe para excluir. */}
            {nadaEncontrado && <p className="text-tinta-suave text-corpo mt-3">Ninguém com esse nome.</p>}
          </Command>
        </div>
      </GrupoDeEscolha>

      {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
