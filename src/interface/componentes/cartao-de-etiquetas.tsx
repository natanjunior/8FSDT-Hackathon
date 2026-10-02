"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { Cartao, CorpoDoCartao, FaixaDoCartao } from "@/interface/componentes/cartao";
import {
  LIMITE_DO_NOME,
  TEXTO_DO_LIMITE,
  nomeParaCriar,
  sugestoes,
  type EtiquetaNaTela,
} from "@/interface/componentes/etiquetas-de-participante";
import { avisarErro, avisarSucesso, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { buttonVariants } from "@/interface/componentes/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/interface/componentes/ui/command";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/interface/componentes/ui/sheet";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  T-08 · editar participante — as etiquetas (item 115, critério 1)
 * ============================================================================
 *
 * **Fora do formulário, e antes dele.** O formulário salva no rodapé; este cartão grava a cada gesto. Dentro
 * do formulário a etiqueta seria lida como campo que espera *Salvar*.
 *
 * **O painel é o do item 87**, tela cheia no celular: a busca tem teclado, e gaveta inferior com teclado
 * aberto some atrás dele.
 *
 * **Sugerir ignora acento; criar não** — as duas regras de `etiquetas-de-participante.ts`.
 */
export function CartaoDeEtiquetas({
  pessoaId,
  nome,
  organizacaoId,
  daPessoa,
  todas,
}: {
  pessoaId: string;
  nome: string;
  organizacaoId: string;
  daPessoa: readonly EtiquetaNaTela[];
  todas: readonly EtiquetaNaTela[];
}) {
  const router = useRouter();
  const [tirando, setTirando] = useState<string | null>(null);

  async function tirar(etiqueta: EtiquetaNaTela): Promise<void> {
    setTirando(etiqueta.id);
    try {
      const resposta = await fetch(`/api/vinculos/${pessoaId}/etiquetas/${etiqueta.id}`, {
        method: "DELETE",
        headers: cabecalhosDeEscrita(organizacaoId),
      });
      if (!resposta.ok) {
        avisarErro("Não foi possível tirar a etiqueta.", mensagemDoProblema(await resposta.json().catch(() => null)));
        return;
      }
      avisarSucesso(`${etiqueta.nome} tirada`);
      router.refresh();
    } catch {
      avisarErro("Não foi possível tirar a etiqueta.", "Verifique a conexão e tente de novo.");
    } finally {
      setTirando(null);
    }
  }

  return (
    <Cartao tituloId="bloco-etiquetas">
      <FaixaDoCartao
        dado={<PainelDeEtiquetar pessoaId={pessoaId} nome={nome} organizacaoId={organizacaoId} daPessoa={daPessoa} todas={todas} />}
      >
        <h2 id="bloco-etiquetas" className="text-tinta-suave text-rotulo-coluna font-mono uppercase">
          Etiquetas
        </h2>
      </FaixaDoCartao>
      <CorpoDoCartao>
        {daPessoa.length === 0 ? (
          <p className="text-tinta-suave text-corpo">Sem etiqueta.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {daPessoa.map((etiqueta) => (
              <li key={etiqueta.id} className="border-linha flex items-center gap-1 rounded-sm border pl-3">
                <span className="text-tinta text-interface">{etiqueta.nome}</span>
                <BotaoDeIcone
                  rotulo={`Tirar ${etiqueta.nome}`}
                  icone={<X aria-hidden="true" className="size-4" />}
                  className="size-11 shrink-0"
                  disabled={tirando !== null}
                  onClick={() => {
                    void tirar(etiqueta);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </CorpoDoCartao>
    </Cartao>
  );
}

function PainelDeEtiquetar({
  pessoaId,
  nome,
  organizacaoId,
  daPessoa,
  todas,
}: {
  pessoaId: string;
  nome: string;
  organizacaoId: string;
  daPessoa: readonly EtiquetaNaTela[];
  todas: readonly EtiquetaNaTela[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lista = sugestoes(todas, daPessoa, texto);
  const criar = nomeParaCriar(todas, texto);
  const longo = texto.trim().length > LIMITE_DO_NOME;

  async function adicionar(nomeDaEtiqueta: string): Promise<void> {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/vinculos/${pessoaId}/etiquetas`, {
        method: "POST",
        headers: { "content-type": "application/json", ...cabecalhosDeEscrita(organizacaoId) },
        body: JSON.stringify({ nome: nomeDaEtiqueta }),
      });
      if (!resposta.ok) {
        setErro(mensagemDoProblema(await resposta.json().catch(() => null)));
        return;
      }
      const corpo = (await resposta.json()) as { etiqueta: EtiquetaNaTela };
      avisarSucesso(`${corpo.etiqueta.nome} adicionada`);
      setTexto("");
      router.refresh();
    } catch {
      setErro("Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (!proximo) {
          setTexto("");
          setErro(null);
        }
      }}
    >
      <SheetTrigger
        className={cn(buttonVariants({ variant: "outline" }), "min-h-11 font-sans normal-case tracking-normal")}
      >
        <Plus aria-hidden="true" className="size-4" />
        Adicionar
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-none gap-0 sm:max-w-none md:max-w-md">
        <SheetHeader className="pr-14">
          <SheetTitle>Etiquetas de {nome}</SheetTitle>
          <SheetDescription>Escolha uma etiqueta ou escreva uma nova. Só quem gere participantes vê.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4">
          <span aria-hidden="true" className="text-tinta text-interface font-medium">
            Etiqueta
          </span>
          <Command shouldFilter={false} label="Etiqueta" className="bg-transparent">
            <CommandInput
              autoFocus
              value={texto}
              onValueChange={setTexto}
              maxLength={LIMITE_DO_NOME + 10}
              className="text-tinta h-11"
            />
            {longo && <p className="text-destructive text-meta">{TEXTO_DO_LIMITE}</p>}
            {erro !== null && <p className="text-destructive text-meta">{erro}</p>}
            <CommandList label="Etiquetas" className="mt-3 max-h-none overflow-visible">
              {lista.map((etiqueta) => (
                <CommandItem
                  key={etiqueta.id}
                  value={etiqueta.id}
                  disabled={enviando}
                  onSelect={() => void adicionar(etiqueta.nome)}
                  className="min-h-11"
                >
                  {etiqueta.nome}
                </CommandItem>
              ))}
              {criar !== null && (
                <CommandItem
                  value={`criar:${criar}`}
                  disabled={enviando}
                  onSelect={() => void adicionar(criar)}
                  className="min-h-11"
                >
                  {`Criar “${criar}”`}
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </div>
      </SheetContent>
    </Sheet>
  );
}
