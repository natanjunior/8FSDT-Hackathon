"use client";

import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { ErroDoFormulario, IndicadorDeEnvio } from "@/interface/componentes/campo";
import {
  FRASE_DO_MOTIVO,
  TEXTOS_DO_ENVIO,
  desfechoDoLote,
  excessoDoLote,
  perguntaDoLote,
  rotuloDoBotaoEmMassa,
  tituloDosEnviados,
  tituloDosNaoEnviados,
} from "@/interface/componentes/envio-de-convite";
import { useSelecao } from "@/interface/componentes/provedor-da-selecao";
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
import type { ResumoDoEnvioProjetado } from "@/interface/projecoes";

const BOTAO = "text-interface min-h-11 rounded-sm px-4";

type Fase =
  | { tipo: "pergunta" }
  | { tipo: "enviando" }
  | { tipo: "resumo"; resumo: ResumoDoEnvioProjetado }
  | { tipo: "falha-inteira" };

/**
 * ============================================================================
 *  *Convidar por e-mail* — o envio em massa da lista de participantes (item 122)
 * ============================================================================
 *
 * **Três fases num diálogo só**: a pergunta, o envio e o resumo. Acima do lote, o diálogo **não tem botão
 * de confirmar**: diz quantos desmarcar e oferece só *Voltar*. Escolher quem fica de fora é do Gestor.
 *
 * **Enquanto envia, o diálogo não fecha** por `Esc` nem por fora: a requisição envia um por um, dentro
 * dela, e fechar no meio esconderia o resumo.
 *
 * **O ciclo é local, e não o `useEnvioDoModal`**: aquele fecha o modal no sucesso, e aqui o sucesso é a
 * fase do resumo, no mesmo diálogo. A falha inteira (rede, servidor, tempo) não limpa a seleção: o Gestor
 * pode olhar e tentar de novo.
 */
export function ConviteEmMassa({ organizacaoId }: { organizacaoId: string }) {
  const router = useRouter();
  const { selecao, limpar } = useSelecao();
  const [aberto, setAberto] = useState(false);
  const [fase, setFase] = useState<Fase>({ tipo: "pergunta" });

  if (selecao.size === 0 && !aberto) return null;

  const n = selecao.size;
  const excesso = excessoDoLote(n);
  const enviando = fase.tipo === "enviando";

  async function enviar() {
    setFase({ tipo: "enviando" });
    try {
      const resposta = await fetch("/api/convites-pessoais/envios", {
        method: "POST",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify({ pessoaIds: [...selecao.keys()] }),
      });
      if (desfechoDoLote(resposta.status) === "falha-inteira") {
        setFase({ tipo: "falha-inteira" });
        return;
      }
      setFase({ tipo: "resumo", resumo: (await resposta.json()) as ResumoDoEnvioProjetado });
    } catch {
      setFase({ tipo: "falha-inteira" });
    }
  }

  function mudarAbertura(proximo: boolean) {
    if (enviando) return;
    setAberto(proximo);
    if (proximo) return setFase({ tipo: "pergunta" });
    if (fase.tipo === "resumo") {
      limpar();
      router.refresh();
    }
  }

  return (
    <AlertDialog open={aberto} onOpenChange={mudarAbertura}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className={`border-linha ${BOTAO}`}>
          <Mail aria-hidden="true" />
          {rotuloDoBotaoEmMassa(n)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        className="bg-superficie border-linha max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onEscapeKeyDown={(evento) => {
          if (enviando) evento.preventDefault();
        }}
      >
        {fase.tipo === "resumo" ? (
          <Resumo resumo={fase.resumo} nomes={selecao} />
        ) : (
          <AlertDialogHeader>
            <AlertDialogTitle className="text-titulo-bloco text-tinta">{perguntaDoLote(n)}</AlertDialogTitle>
            <AlertDialogDescription className="text-corpo text-tinta-suave">
              {excesso ?? "Cada pessoa recebe o link do próprio convite, no primeiro e-mail cadastrado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
        )}

        {fase.tipo === "falha-inteira" && <ErroDoFormulario>{TEXTOS_DO_ENVIO.falhaInteira}</ErroDoFormulario>}

        <AlertDialogFooter>
          {fase.tipo === "resumo" || fase.tipo === "falha-inteira" ? (
            <AlertDialogCancel variant="marca" className={`${BOTAO} font-semibold`}>
              {TEXTOS_DO_ENVIO.fechar}
            </AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={enviando} className={`border-linha ${BOTAO}`}>
                {TEXTOS_DO_ENVIO.voltar}
              </AlertDialogCancel>
              {excessoDoLote(n) === null && (
                // Botão comum, e não `AlertDialogAction`: a ação fecharia o diálogo antes do resumo.
                <Button
                  type="button"
                  variant="marca"
                  disabled={enviando}
                  onClick={() => void enviar()}
                  className={`${BOTAO} font-semibold`}
                >
                  <IndicadorDeEnvio ativo={enviando} />
                  {enviando ? TEXTOS_DO_ENVIO.enviando : TEXTOS_DO_ENVIO.enviar}
                </Button>
              )}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Resumo({ resumo, nomes }: { resumo: ResumoDoEnvioProjetado; nomes: ReadonlyMap<string, string> }) {
  return (
    <AlertDialogHeader>
      <AlertDialogTitle className="text-titulo-bloco text-tinta">
        {tituloDosEnviados(resumo.enviados.length)}
      </AlertDialogTitle>
      <AlertDialogDescription asChild>
        <div className="text-corpo text-tinta-suave flex flex-col gap-4 text-left">
          {resumo.enviados.length > 0 && (
            <ul className="flex flex-col gap-1">
              {resumo.enviados.map((enviado) => (
                <li key={enviado.pessoaId}>
                  <span className="text-tinta">{enviado.nome}</span> · <span className="break-all">{enviado.email}</span>
                </li>
              ))}
            </ul>
          )}
          {resumo.naoEnviados.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-interface text-tinta font-semibold">
                {tituloDosNaoEnviados(resumo.naoEnviados.length)}
              </h3>
              <ul className="flex flex-col gap-1">
                {resumo.naoEnviados.map((naoEnviado) => (
                  <li key={naoEnviado.pessoaId}>
                    <span className="text-tinta">{naoEnviado.nome ?? nomes.get(naoEnviado.pessoaId) ?? "—"}</span> ·{" "}
                    {FRASE_DO_MOTIVO[naoEnviado.motivo]}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
  );
}
