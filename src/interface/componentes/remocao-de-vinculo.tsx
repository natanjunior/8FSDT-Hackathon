"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { ErroDoFormulario, IndicadorDeEnvio } from "@/interface/componentes/campo";
import {
  TEXTOS_DA_REMOCAO,
  faceDepoisDaRecusa,
  faceInicial,
  razaoDoImpedimento,
  textoDaConfirmacao,
  textoDaRecusa,
  textoDoEncerramento,
  tituloDaConfirmacao,
  tituloDoEncerramento,
  tituloDoImpedimento,
  type FaceDaRemocao,
  type ImpedimentoNaTela,
} from "@/interface/componentes/frases-da-remocao";
import {
  FALHA,
  TEXTOS_DA_TABELA,
  avisoDeAcessoEncerrado,
  avisoDeRemovido,
} from "@/interface/componentes/frases-de-participantes";
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
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";

/**
 * ============================================================================
 *  T-08 · remover da organização — o conserto do PA-25, e o único `DELETE`
 * ============================================================================
 *
 * **O botão existe em toda linha de vínculo** (critério 44j.4, decidido pelo dono em 16/09/2026). Até
 * aqui a razão substituía o botão; hoje o clique abre o aviso com a razão ou a confirmação, conforme o
 * parágrafo do item 84 abaixo, que é o que o guia manda fazer com ação que não pode acontecer: *"o clique
 * abre um aviso que diz por quê, em vez de o botão sumir"*. Quem decide qual abre é
 * `impedimentosDeRemocao`, lido pela página.
 *
 * **A confirmação é o `alert-dialog` do catálogo** (critério 44j.11), e **quem confirma não é o botão de
 * ação do primitivo**, que fecha no clique: é um botão de envio, e quem fecha é o ciclo do 44g — durante
 * o envio nada fecha, no sucesso o aviso sai e a página se atualiza, no erro a mensagem fica dentro da
 * confirmação.
 *
 * **O toque no aviso não fecha esta peça**, e ela não precisa da guarda do `dialog.tsx`: o primitivo
 * recusa fechamento por interação de fora.
 *
 * **Quando a linha sai da tabela**, o gatilho some com ela e o foco cairia no `body`: `aoSair` leva o
 * foco à opção marcada do filtro rápido.
 *
 * **`organizacaoId` é o da renderização daquela aba** — a afirmação do contrato §4.3 —, recebido por
 * propriedade e nunca lido do cookie no clique.
 *
 * **Item 84 — um ponto de entrada, três faces.** O clique abre a confirmação de remover (sem rastro), a
 * de encerrar o acesso (com rastro), ou o aviso do último Gestor. As duas confirmações dividem o mesmo
 * ciclo de envio: a face decide o endereço, o texto e o aviso de sucesso. **A face do aviso sai da
 * propriedade**, e não do estado, porque nenhuma recusa leva a ela nem sai dela.
 *
 * **A face das confirmações é estado**, porque o `409 VINCULO_COM_HISTORICO` troca a de remover pela de
 * encerrar sem fechar (spec §3.8). `aoAbrir` a devolve à face inicial a cada abertura.
 */

const CONTEUDO = "bg-superficie border-linha";
const TITULO = "text-titulo-bloco text-tinta";
const DESCRICAO = "text-corpo text-tinta-suave";
const BOTAO = "text-interface min-h-11 rounded-sm px-4";

export function RemocaoDeVinculo({
  pessoaId,
  nome,
  temConta,
  impedimento,
  responsavelEmAberto,
  organizacaoId,
  ehMeuProprioVinculo,
  descritoPor,
  aoSair,
}: {
  pessoaId: string;
  nome: string;
  temConta: boolean;
  /** `null` é *pode sair* — a ausência no mapa de `impedimentosDeRemocao`. */
  impedimento: ImpedimentoNaTela | null;
  /** Quantas ocorrências em aberto têm esta pessoa como responsável. Zero é ausência no mapa. */
  responsavelEmAberto: number;
  organizacaoId: string;
  ehMeuProprioVinculo: boolean;
  /** O `id` do nome na linha, para a dica e o rótulo não precisarem repeti-lo. */
  descritoPor?: string | undefined;
  aoSair?: (() => void) | undefined;
}) {
  const [saiu, setSaiu] = useState(false);
  const [face, setFace] = useState<FaceDaRemocao>(faceInicial(impedimento));
  const encerrando = face === "encerrar";

  const envio = useEnvioDoModal({
    enviar: async (): Promise<DesfechoDoEnvio<undefined>> => {
      const resposta = await fetch(
        encerrando ? `/api/vinculos/${pessoaId}/revogar` : `/api/vinculos/${pessoaId}`,
        { method: encerrando ? "POST" : "DELETE", headers: cabecalhosDeEscrita(organizacaoId) },
      );
      if (resposta.ok) return { ok: true };
      const corpo: unknown = await resposta.json().catch(() => null);
      setFace(faceDepoisDaRecusa(face, corpo));
      return { ok: false, aviso: textoDaRecusa(corpo, nome) };
    },
    aoConcluir: () => {
      setSaiu(true);
      return encerrando ? avisoDeAcessoEncerrado(nome) : avisoDeRemovido(nome);
    },
    tituloDaFalha: encerrando ? FALHA.encerrar : FALHA.remover,
    aoAbrir: () => {
      setSaiu(false);
      setFace(faceInicial(impedimento));
    },
  });

  const gatilho = (
    <AlertDialogTrigger asChild>
      <BotaoDeIcone
        rotulo={TEXTOS_DA_TABELA.remover}
        icone={<Trash2 aria-hidden="true" />}
        descritoPor={descritoPor}
      />
    </AlertDialogTrigger>
  );

  if (faceInicial(impedimento) === "aviso") {
    return (
      <AlertDialog>
        {gatilho}
        <AlertDialogContent className={CONTEUDO}>
          <AlertDialogHeader>
            <AlertDialogTitle className={TITULO}>{tituloDoImpedimento(nome)}</AlertDialogTitle>
            <AlertDialogDescription className={DESCRICAO}>
              {razaoDoImpedimento(nome, "ultimo-gestor")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="marca" className={`${BOTAO} font-semibold`}>
              {TEXTOS_DA_REMOCAO.entendi}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const titulo = encerrando ? tituloDoEncerramento(nome) : tituloDaConfirmacao(nome);
  const linhas = encerrando
    ? textoDoEncerramento({ nome, temConta, ehMeuProprioVinculo, responsavelEmAberto })
    : textoDaConfirmacao({ nome, temConta, ehMeuProprioVinculo });
  const rotuloDaAcao = encerrando
    ? envio.enviando
      ? TEXTOS_DA_REMOCAO.encerrando
      : TEXTOS_DA_REMOCAO.encerrar
    : envio.enviando
      ? TEXTOS_DA_REMOCAO.removendo
      : TEXTOS_DA_REMOCAO.remover;

  return (
    <AlertDialog open={envio.aberto} onOpenChange={envio.mudarAbertura}>
      {gatilho}
      <AlertDialogContent
        className={CONTEUDO}
        onCloseAutoFocus={(evento) => {
          if (!saiu) return;
          evento.preventDefault();
          setSaiu(false);
          aoSair?.();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className={TITULO}>{titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className={`${DESCRICAO} flex flex-col gap-2`}>
              {linhas.map((linha) => (
                <p key={linha}>{linha}</p>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={envio.enviando} className={`border-linha ${BOTAO}`}>
            {TEXTOS_DA_REMOCAO.cancelar}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={envio.enviando}
            onClick={() => void envio.confirmar()}
            className={`${BOTAO} font-semibold`}
          >
            <IndicadorDeEnvio ativo={envio.enviando} />
            {rotuloDaAcao}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
