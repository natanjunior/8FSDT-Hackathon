"use client";

import { Search, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { ErroDoFormulario, IndicadorDeEnvio } from "@/interface/componentes/campo";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import {
  LIMITE_DO_NOME,
  contagemDeParticipantes,
  filtrarEtiquetas,
  textoDoApagar,
  tituloDoApagar,
  type EtiquetaNaTela,
} from "@/interface/componentes/etiquetas-de-participante";
import { ModalDeNovaEtiqueta } from "@/interface/componentes/modal-de-nova-etiqueta";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/interface/componentes/ui/alert-dialog";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";

/** As classes da confirmação de remover (`remocao-de-vinculo.tsx`), para apagar ter a mesma cara. */
const CONTEUDO = "bg-superficie border-linha";
const TITULO = "text-titulo-bloco text-tinta";
const DESCRICAO = "text-corpo text-tinta-suave";
const BOTAO = "text-interface min-h-11 rounded-sm px-4";

/**
 * ============================================================================
 *  T-15 · o cartão *Etiquetas de participantes* (item 120, blocos 5 e 9)
 * ============================================================================
 *
 * **Na configuração, e não em Participantes** — ordem do dono em 03/10/2026, que chamou de erro a gerência
 * morar na lista de gente. **`vinculo.gerir` guarda o cartão**, e é a página que o decide.
 *
 * **No molde de Categorias e Áreas** (`lista-de-ordem-manual.tsx`): a busca é a primeira linha, resolvida no
 * navegador, e o que não casa some. **Só apagar**: etiqueta não tem editar nem ordem (decisão 8 do 115).
 *
 * **A contagem está na linha**, e é o MESMO número da confirmação de apagar: os dois saem de `uso`, que a
 * página calcula uma vez com `usoPorEtiqueta` sobre os vínculos ativos.
 */
export function EtiquetasDaOrganizacao({
  etiquetas,
  uso,
  organizacaoId,
}: {
  etiquetas: readonly EtiquetaNaTela[];
  /** Por `id`, quantas pessoas a têm. **Ausente é zero.** */
  uso: Readonly<Record<string, number>>;
  organizacaoId: string;
}) {
  const prefixo = useId();
  const [busca, setBusca] = useState("");
  const visiveis = filtrarEtiquetas(etiquetas, busca);

  return (
    <Cartao tituloId="etiquetas">
      <CabecaDoCartao
        id="etiquetas"
        titulo="Etiquetas de participantes"
        apoio="Nomes livres para marcar participantes."
        acao={<ModalDeNovaEtiqueta organizacaoId={organizacaoId} />}
      />
      {etiquetas.length === 0 ? (
        <p className="text-interface text-tinta-suave p-[15px] md:px-6 md:py-5">Nenhuma etiqueta ainda.</p>
      ) : (
        <>
          <div className="border-linha-suave flex flex-col gap-1.5 border-b px-4 py-3">
            <label htmlFor={`${prefixo}-busca`} className="text-interface text-tinta font-medium">
              Buscar pelo nome
            </label>
            <div className="relative md:w-72">
              <Search
                aria-hidden="true"
                className="text-tinta-suave pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                id={`${prefixo}-busca`}
                type="search"
                inputMode="search"
                autoComplete="off"
                maxLength={LIMITE_DO_NOME}
                placeholder="Ex.: eletricista"
                value={busca}
                onChange={(evento) => {
                  setBusca(evento.currentTarget.value);
                }}
                className="border-linha bg-background h-11 pl-9"
              />
            </div>
          </div>
          {visiveis.length === 0 ? (
            <p className="text-interface text-tinta-suave p-[15px] md:px-6 md:py-5">Nenhuma etiqueta com esse nome.</p>
          ) : (
            <ul>
              {visiveis.map((etiqueta) => (
                <li
                  key={etiqueta.id}
                  className="border-linha-suave flex min-h-11 items-center gap-3 border-b px-4 py-1 last:border-b-0"
                >
                  <span className="text-interface text-tinta min-w-0 flex-1 truncate">{etiqueta.nome}</span>
                  <span className="text-meta text-tinta-suave shrink-0 tabular-nums">
                    {contagemDeParticipantes(uso[etiqueta.id] ?? 0)}
                  </span>
                  <ApagarEtiqueta etiqueta={etiqueta} quantas={uso[etiqueta.id] ?? 0} organizacaoId={organizacaoId} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Cartao>
  );
}

function ApagarEtiqueta({
  etiqueta,
  quantas,
  organizacaoId,
}: {
  etiqueta: EtiquetaNaTela;
  quantas: number;
  organizacaoId: string;
}) {
  const envio = useEnvioDoModal({
    enviar: async (): Promise<DesfechoDoEnvio<undefined>> => {
      const resposta = await fetch(`/api/etiquetas-de-participante/${etiqueta.id}`, {
        method: "DELETE",
        headers: cabecalhosDeEscrita(organizacaoId),
      });
      if (resposta.ok) return { ok: true };
      return { ok: false, aviso: mensagemDoProblema(await resposta.json().catch(() => null)) };
    },
    aoConcluir: () => ({ titulo: `${etiqueta.nome} apagada` }),
    tituloDaFalha: "Não foi possível apagar a etiqueta",
  });

  return (
    <AlertDialog open={envio.aberto} onOpenChange={envio.mudarAbertura}>
      <AlertDialogTrigger asChild>
        <BotaoDeIcone
          rotulo={`Apagar ${etiqueta.nome}`}
          icone={<Trash2 aria-hidden="true" className="size-4" />}
          className="size-11 shrink-0"
        />
      </AlertDialogTrigger>
      <AlertDialogContent className={CONTEUDO}>
        <AlertDialogHeader>
          <AlertDialogTitle className={TITULO}>{tituloDoApagar(etiqueta.nome)}</AlertDialogTitle>
          <AlertDialogDescription className={DESCRICAO}>{textoDoApagar(quantas)}</AlertDialogDescription>
        </AlertDialogHeader>
        {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={envio.enviando} className={`border-linha ${BOTAO}`}>
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={envio.enviando}
            onClick={() => void envio.confirmar()}
            className={`${BOTAO} font-semibold`}
          >
            <IndicadorDeEnvio ativo={envio.enviando} />
            {envio.enviando ? "Apagando…" : "Apagar etiqueta"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
