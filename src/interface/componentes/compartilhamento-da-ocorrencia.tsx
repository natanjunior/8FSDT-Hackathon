"use client";

import { Check, Share2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import {
  aposCompartilhar,
  aposDesfazer,
  buscaProntaParaPedir,
  ESPERA_DA_BUSCA_MS,
  motivoEscrito,
  textoDoVazioDaBusca,
  type CandidatoNaTela,
} from "@/interface/componentes/busca-de-compartilhamento";
import { Cartao, CorpoDoCartao, FaixaDoCartao } from "@/interface/componentes/cartao";
import { avisarErro, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { buttonVariants } from "@/interface/componentes/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/interface/componentes/ui/command";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/interface/componentes/ui/sheet";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  T-05 · Compartilhada com, e o painel de escolher (item 87)
 * ============================================================================
 *
 * **O gesto mora num cartão da coluna de apoio, e não na barra do cabeçalho.** A barra é das ações do
 * ciclo, e `acoesDaBarra` decide o que é primário entre elas: um *Compartilhar* ali disputaria o primário
 * com *Analisar* ou *Avaliar*, e em estado terminal ficaria sozinho ao lado da frase *"Esta ocorrência
 * está encerrada"*, que é o contrário do que ele diz. No cartão, o gesto fica junto do estado que ele muda.
 *
 * **Quem recebeu a ocorrência não vê este cartão** — quem decide é a página, pela face do
 * `compartilhamento` que a projeção devolveu.
 *
 * **Os textos chegam prontos:** o papel já em palavra e a data já formatada, montados pelo servidor. É a
 * mesma decisão dos rótulos de status — o navegador não monta rótulo.
 */

export type PessoaNoCartao = {
  readonly pessoaId: string;
  readonly nome: string;
  /** Já em palavra. */
  readonly papel: string;
  /** Já formatada. */
  readonly compartilhadoEm: string;
  readonly porNome: string;
  readonly podeDesfazer: boolean;
};

export function CartaoDeCompartilhamento({
  ocorrenciaId,
  organizacaoId,
  pessoas,
}: {
  ocorrenciaId: string;
  organizacaoId: string;
  pessoas: readonly PessoaNoCartao[];
}) {
  const router = useRouter();
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  async function desfazer(pessoa: PessoaNoCartao): Promise<void> {
    setDesfazendo(pessoa.pessoaId);
    try {
      const resposta = await fetch(
        `/api/ocorrencias/${ocorrenciaId}/compartilhamentos/${pessoa.pessoaId}`,
        { method: "DELETE", headers: cabecalhosDeEscrita(organizacaoId) },
      );
      if (!resposta.ok) {
        avisarErro(
          "Não foi possível desfazer.",
          mensagemDoProblema(await resposta.json().catch(() => null)),
        );
        return;
      }
      router.refresh();
    } catch {
      avisarErro("Não foi possível desfazer.", "Verifique a conexão e tente de novo.");
    } finally {
      setDesfazendo(null);
    }
  }

  return (
    <Cartao tituloId="bloco-compartilhada">
      <FaixaDoCartao
        dado={
          <PainelDeCompartilhar
            ocorrenciaId={ocorrenciaId}
            organizacaoId={organizacaoId}
            aoFechar={() => {
              router.refresh();
            }}
          />
        }
      >
        <h2 id="bloco-compartilhada" className="text-tinta-suave text-rotulo-coluna font-mono uppercase">
          Compartilhada com
        </h2>
      </FaixaDoCartao>

      <CorpoDoCartao>
        {pessoas.length === 0 ? (
          <p className="text-tinta-suave text-corpo">
            Só quem registrou e os Gestores veem esta ocorrência.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pessoas.map((pessoa) => (
              <li key={pessoa.pessoaId} className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-tinta text-interface">
                    {pessoa.nome}
                    <span className="text-tinta-suave">{` · ${pessoa.papel}`}</span>
                  </span>
                  <span className="text-tinta-suave text-meta">
                    {`por ${pessoa.porNome} em ${pessoa.compartilhadoEm}`}
                  </span>
                </span>
                {/* **Só nas linhas que quem olha pode desfazer.** O autor que vê a linha do Gestor a vê
                    sem o botão — é o cenário aprovado, e o servidor decide em `podeDesfazer`. */}
                {pessoa.podeDesfazer && (
                  <BotaoDeIcone
                    rotulo={`Desfazer o compartilhamento com ${pessoa.nome}`}
                    icone={<X aria-hidden="true" className="size-4" />}
                    className="size-11 shrink-0"
                    disabled={desfazendo !== null}
                    onClick={() => {
                      void desfazer(pessoa);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </CorpoDoCartao>
    </Cartao>
  );
}

/**
 * **Tela cheia no celular, painel lateral na tela grande.**
 *
 * **Não é a gaveta inferior** que as outras ações de T-05 usam: a busca tem teclado, e gaveta inferior com
 * teclado aberto some atrás dele. `docs/telas.md` carrega essa exceção escrita.
 *
 * **Tocar numa pessoa compartilha na hora**, uma requisição por pessoa: não há seleção acumulada nem botão
 * de confirmar. É o *"uma pessoa por vez"* da entrevista, e é o que faz *"desfazer ali mesmo"* ser o mesmo
 * gesto ao contrário.
 */
function PainelDeCompartilhar({
  ocorrenciaId,
  organizacaoId,
  aoFechar,
}: {
  ocorrenciaId: string;
  organizacaoId: string;
  aoFechar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [itens, setItens] = useState<readonly CandidatoNaTela[]>([]);
  const [pendente, setPendente] = useState<string | null>(null);
  const [erroDaLinha, setErroDaLinha] = useState<Record<string, string>>({});

  /**
   * **A busca espera o dedo parar.** Sem isso, um nome de oito letras manda oito pedidos ao servidor.
   * O `AbortController` cancela o anterior: a resposta de *"Mar"* chegando depois da de *"Marcos"*
   * pintaria a lista errada.
   */
  useEffect(() => {
    if (!aberto || !buscaProntaParaPedir(texto)) return;
    const controle = new AbortController();
    const relogio = setTimeout(() => {
      void (async () => {
        try {
          const resposta = await fetch(
            `/api/ocorrencias/${ocorrenciaId}/candidatos-ao-compartilhamento?busca=${encodeURIComponent(texto.trim())}`,
            { signal: controle.signal },
          );
          if (!resposta.ok) return;
          const corpo = (await resposta.json()) as { itens: readonly CandidatoNaTela[] };
          setItens(corpo.itens);
        } catch {
          // Pedido cancelado ou rede fora: a lista fica como está, e o vazio já diz o que fazer.
        }
      })();
    }, ESPERA_DA_BUSCA_MS);
    return () => {
      controle.abort();
      clearTimeout(relogio);
    };
  }, [aberto, texto, ocorrenciaId]);

  async function escrever(pessoa: CandidatoNaTela, desfazer: boolean): Promise<void> {
    setPendente(pessoa.pessoaId);
    setErroDaLinha((atual) =>
      Object.fromEntries(Object.entries(atual).filter(([chave]) => chave !== pessoa.pessoaId)),
    );
    try {
      const resposta = desfazer
        ? await fetch(`/api/ocorrencias/${ocorrenciaId}/compartilhamentos/${pessoa.pessoaId}`, {
            method: "DELETE",
            headers: cabecalhosDeEscrita(organizacaoId),
          })
        : await fetch(`/api/ocorrencias/${ocorrenciaId}/compartilhamentos`, {
            method: "POST",
            headers: { "content-type": "application/json", ...cabecalhosDeEscrita(organizacaoId) },
            body: JSON.stringify({ pessoaId: pessoa.pessoaId }),
          });
      if (!resposta.ok) {
        // A linha volta ao estado anterior, com a frase da resposta embaixo dela. O painel não fecha.
        const mensagem = mensagemDoProblema(await resposta.json().catch(() => null));
        setErroDaLinha((atual) => ({ ...atual, [pessoa.pessoaId]: mensagem }));
        return;
      }
      setItens((atual) =>
        desfazer ? aposDesfazer(atual, pessoa.pessoaId) : aposCompartilhar(atual, pessoa.pessoaId),
      );
    } catch {
      setErroDaLinha((atual) => ({
        ...atual,
        [pessoa.pessoaId]: "Verifique a conexão e tente de novo.",
      }));
    } finally {
      setPendente(null);
    }
  }

  /**
   * **A lista abaixo do mínimo de letras é vazia por DERIVAÇÃO, e não por `setItens([])` no efeito.**
   * Apagar por efeito é um segundo render em cascata, e o resultado é o mesmo: o que estiver guardado de
   * uma busca anterior não pertence a um campo que voltou a ficar curto.
   */
  const visiveis = buscaProntaParaPedir(texto) ? itens : [];

  return (
    <Sheet
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (!proximo) {
          setTexto("");
          setItens([]);
          setErroDaLinha({});
          aoFechar();
        }
      }}
    >
      {/* **Fonte e caixa do texto voltam ao normal**: o `dado` da faixa é monoespaçado e em caixa alta, e
          um botão herdaria isso. É o mesmo ajuste do link da auditoria, no mesmo desenho de tela. */}
      <SheetTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "min-h-11 font-sans normal-case tracking-normal",
        )}
      >
        <Share2 aria-hidden="true" className="size-4" />
        Compartilhar
      </SheetTrigger>

      {/* Tela cheia abaixo de `md`; painel de largura fixa a partir dele. As duas classes sobrescrevem o
          `w-3/4 sm:max-w-sm` do catálogo. */}
      <SheetContent side="right" className="w-full max-w-none gap-0 sm:max-w-none md:max-w-md">
        <SheetHeader>
          <SheetTitle>Compartilhar</SheetTitle>
          <SheetDescription>
            Quem você escolher passa a ver esta ocorrência, sem poder mudar nada.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4">
          {/* O rótulo visível é `aria-hidden`, e o nome acessível vem do `label` do `Command`: o `cmdk`
              impõe `id` e `aria-labelledby` ao campo. É o idioma do modal de atribuição. */}
          <span aria-hidden="true" className="text-tinta text-interface font-medium">
            Buscar pelo nome
          </span>
          <Command shouldFilter={false} label="Buscar pelo nome" className="bg-transparent">
            <CommandInput
              autoFocus
              value={texto}
              onValueChange={setTexto}
              maxLength={120}
              className="text-tinta h-11"
            />
            {/* O `label` da lista é obrigatório: sem ele o `cmdk` nomeia o `listbox` de *"Suggestions"*. */}
            <CommandList label="Pessoas" className="mt-3 max-h-none overflow-visible">
              {visiveis.map((pessoa) => {
                const motivo = motivoEscrito(pessoa);
                const jaCompartilhada = pessoa.situacao === "ja_compartilhada";
                return (
                  <CommandItem
                    key={pessoa.pessoaId}
                    value={pessoa.pessoaId}
                    disabled={pessoa.situacao === "ja_ve" || pendente !== null}
                    onSelect={() => {
                      if (pessoa.situacao === "ja_ve") return;
                      void escrever(pessoa, jaCompartilhada);
                    }}
                    className="min-h-11 items-start gap-3"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-tinta font-medium">{pessoa.nome}</span>
                      <span className="text-tinta-suave text-meta">
                        {pessoa.papel}
                        {motivo !== null && ` · ${motivo}`}
                      </span>
                      {erroDaLinha[pessoa.pessoaId] !== undefined && (
                        <span className="text-destructive text-meta">
                          {erroDaLinha[pessoa.pessoaId]}
                        </span>
                      )}
                    </span>
                    {/* **A marca e o desfazer são TEXTO do próprio item, nunca um botão.** Dentro de um
                        `listbox` só cabem `option` e `group`, e um `<button>` ali é ARIA inválido. Então o
                        toque no item já compartilhado é o desfazer, e o nome acessível da opção diz isso. */}
                    {jaCompartilhada && (
                      <span className="text-tinta-suave text-meta flex shrink-0 items-center gap-1">
                        <Check aria-hidden="true" className="size-4" />
                        Já compartilhada
                        <span className="text-tinta-marca font-medium">Desfazer</span>
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandList>
            {/* **Fora do `listbox`**, pela mesma regra: dentro dele só cabem opção e grupo. E não é o
                `CommandEmpty`, que apareceria também antes do mínimo de letras. */}
            {visiveis.length === 0 && (
              <p role="status" className="text-tinta-suave text-corpo mt-3">
                {textoDoVazioDaBusca(texto)}
              </p>
            )}
          </Command>
        </div>

        <SheetFooter>
          <SheetClose className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
            Pronto
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
