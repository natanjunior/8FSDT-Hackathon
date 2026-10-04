"use client";

import { Check, Copy, RefreshCw, Send, Share2 } from "lucide-react";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { ErroDoFormulario, IndicadorDeEnvio } from "@/interface/componentes/campo";
import {
  TEXTOS_DO_CONVITE_PESSOAL as TEXTOS,
  explicacaoDoModal,
  rodapeDoModal,
  tituloDoModal,
} from "@/interface/componentes/convite-pessoal";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/interface/componentes/ui/dialog";
import { Skeleton } from "@/interface/componentes/ui/skeleton";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { useCopiar } from "@/interface/ganchos/use-copiar";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";
import type { ConviteDoGestorProjetado } from "@/interface/projecoes";

const BOTAO = "text-interface min-h-11 rounded-sm px-4";

/**
 * ============================================================================
 *  *Convidar* — o modal do convite pessoal, no detalhe do participante (item 121)
 * ============================================================================
 *
 * **O link nasce na primeira abertura** e é recuperado nas seguintes: `POST /vinculos/{id}/convite` é
 * idempotente, e abrir o modal duas vezes devolve o mesmo link. *Gerar novo link* pede confirmação, porque
 * o link anterior deixa de funcionar inclusive onde já foi enviado.
 *
 * **O link inteiro aparece num campo só de leitura**, quebrando linha no celular: o código cortado já foi
 * pago uma vez (item 93). *Copiar* vira *Compartilhar* onde o aparelho tem a folha do sistema.
 *
 * `Dialog` do catálogo, e não o `Modal`: o `Modal` é da família de formulário, e aqui não há o que enviar.
 */
export function ConvidarParticipante({
  pessoaId,
  nome,
  organizacaoId,
  organizacao,
  papel,
}: {
  pessoaId: string;
  nome: string;
  organizacaoId: string;
  /** O nome da organização ativa, para a frase do modal. */
  organizacao: string;
  /** O papel em palavra (`rotuloDoPapel`). */
  papel: string;
}) {
  const [convite, setConvite] = useState<ConviteDoGestorProjetado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function garantir() {
    setErro(null);
    try {
      const resposta = await fetch(`/api/vinculos/${pessoaId}/convite`, {
        method: "POST",
        headers: cabecalhosDeEscrita(organizacaoId),
      });
      const corpo: unknown = await resposta.json().catch(() => null);
      if (resposta.ok) setConvite(corpo as ConviteDoGestorProjetado);
      else setErro(mensagemDoProblema(corpo));
    } catch {
      setErro(mensagemDoProblema(null));
    }
  }

  return (
    <Dialog
      onOpenChange={(aberto) => {
        if (aberto) void garantir();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={`border-linha ${BOTAO}`}>
          <Send aria-hidden="true" />
          {TEXTOS.botao}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-superficie border-linha max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-titulo-bloco text-tinta">{tituloDoModal(nome)}</DialogTitle>
          <DialogDescription className="text-corpo text-tinta-suave">
            {explicacaoDoModal(organizacao, papel)}
          </DialogDescription>
        </DialogHeader>

        {erro !== null && <ErroDoFormulario>{erro}</ErroDoFormulario>}

        {convite === null ? (
          erro === null && <Skeleton aria-hidden="true" className="bg-secondary h-16 w-full rounded-sm" />
        ) : (
          <CorpoDoConvite
            convite={convite}
            pessoaId={pessoaId}
            organizacaoId={organizacaoId}
            aoRenovar={setConvite}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CorpoDoConvite({
  convite,
  pessoaId,
  organizacaoId,
  aoRenovar,
}: {
  convite: ConviteDoGestorProjetado;
  pessoaId: string;
  organizacaoId: string;
  aoRenovar: (convite: ConviteDoGestorProjetado) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="link-do-convite-pessoal" className="text-interface text-tinta font-medium">
          {TEXTOS.rotuloDoLink}
        </label>
        <Textarea
          id="link-do-convite-pessoal"
          readOnly
          rows={2}
          value={convite.link}
          className="border-linha bg-background text-meta min-h-0 resize-none font-mono break-all"
          onFocus={(evento) => evento.currentTarget.select()}
        />
      </div>

      {/* Item 122: o bloco do e-mail (endereço, último envio, botão) entra aqui, entre o link e os botões. */}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <BotaoDeCopiar link={convite.link} />
        <GerarNovoLink pessoaId={pessoaId} organizacaoId={organizacaoId} aoRenovar={aoRenovar} />
      </div>

      <p className="text-meta text-tinta-suave">{rodapeDoModal(convite.criadoEm, convite.criadoPor.nome)}</p>
    </div>
  );
}

/**
 * *Copiar*, ou *Compartilhar* onde houver a folha do sistema. **O modal só existe no navegador** (o
 * conteúdo do `Dialog` não é desenhado no servidor), então ler `navigator` aqui não diverge da hidratação.
 * Se a folha recusar com outra coisa que não o cancelamento, cai no copiar.
 */
function BotaoDeCopiar({ link }: { link: string }) {
  const { desfecho, copiar, copiaManual } = useCopiar(link);
  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function agir() {
    if (!podeCompartilhar) return copiar();
    try {
      await navigator.share({ url: link });
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") return;
      await copiar();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="marca" className={`${BOTAO} font-semibold`} onClick={() => void agir()}>
        {desfecho === "copiado" ? (
          <Check aria-hidden="true" />
        ) : podeCompartilhar ? (
          <Share2 aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
        {desfecho === "copiado" ? TEXTOS.copiado : podeCompartilhar ? TEXTOS.compartilhar : TEXTOS.copiar}
      </Button>
      <p role="status" aria-live="polite" className="text-meta text-tinta-suave">
        {desfecho === "selecione" && (
          <>
            Selecione e copie:{" "}
            <span ref={copiaManual} className="text-tinta font-mono break-all select-all">
              {link}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function GerarNovoLink({
  pessoaId,
  organizacaoId,
  aoRenovar,
}: {
  pessoaId: string;
  organizacaoId: string;
  aoRenovar: (convite: ConviteDoGestorProjetado) => void;
}) {
  const envio = useEnvioDoModal<ConviteDoGestorProjetado>({
    enviar: async (): Promise<DesfechoDoEnvio<ConviteDoGestorProjetado>> => {
      const resposta = await fetch(`/api/vinculos/${pessoaId}/convite/renovacao`, {
        method: "POST",
        headers: cabecalhosDeEscrita(organizacaoId),
      });
      const corpo: unknown = await resposta.json().catch(() => null);
      if (resposta.ok) return { ok: true, valor: corpo as ConviteDoGestorProjetado };
      return { ok: false, aviso: mensagemDoProblema(corpo) };
    },
    aoConcluir: (valor) => {
      if (valor !== undefined) aoRenovar(valor);
      return { titulo: TEXTOS.recibo };
    },
    tituloDaFalha: TEXTOS.falhaAoGerar,
  });

  return (
    <AlertDialog open={envio.aberto} onOpenChange={envio.mudarAbertura}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className={`border-linha ${BOTAO}`}>
          <RefreshCw aria-hidden="true" />
          {TEXTOS.gerarNovo}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-superficie border-linha">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-titulo-bloco text-tinta">{TEXTOS.confirmarTitulo}</AlertDialogTitle>
          <AlertDialogDescription className="text-corpo text-tinta-suave">
            {TEXTOS.confirmarCorpo}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={envio.enviando} className={`border-linha ${BOTAO}`}>
            {TEXTOS.cancelar}
          </AlertDialogCancel>
          {/* Botão comum, e não `AlertDialogAction`: a ação fecharia o diálogo antes de o envio terminar. */}
          <Button
            type="button"
            variant="marca"
            disabled={envio.enviando}
            onClick={() => void envio.confirmar()}
            className={`${BOTAO} font-semibold`}
          >
            <IndicadorDeEnvio ativo={envio.enviando} />
            {envio.enviando ? TEXTOS.gerando : TEXTOS.confirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
