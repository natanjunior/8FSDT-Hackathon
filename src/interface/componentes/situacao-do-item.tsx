"use client";

import { EyeOff, RotateCcw } from "lucide-react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { ErroDoFormulario, IndicadorDeEnvio } from "@/interface/componentes/campo";
import {
  FRASES_DA_TELA,
  TEXTOS_DA_LISTA,
  avisoDeSituacao,
  falhaDaSituacao,
  textoDaSituacao,
  type Lista,
} from "@/interface/componentes/frases-da-configuracao";
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
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";

/**
 * ============================================================================
 *  Desativar e reativar — a confirmação própria de T-09 e T-14 (item 44k)
 * ============================================================================
 *
 * **Um componente para as duas listas** (critério 7), parametrizado pelo substantivo e pelo endereço do
 * `PATCH`. É o `alert-dialog` do catálogo, no molde de `remocao-de-vinculo.tsx`: **quem confirma não é o
 * `AlertDialogAction`**, que fecha no clique — é um botão de envio comum, e quem fecha é o ciclo do 44g.
 * Durante o envio nada fecha; no sucesso o aviso sai e a página se atualiza; no erro a mensagem fica
 * dentro da confirmação.
 *
 * **A explicação de que desativar não apaga mora aqui** (critério 10): ela saiu do corpo das duas telas,
 * onde estava solta, e passou para o momento em que a pessoa decide.
 *
 * **A última ativa** acrescenta a frase que o inventário obriga — *"Sem nenhuma {categoria | área} ativa,
 * ninguém consegue registrar ocorrência."* — e o botão passa a dizer *"Desativar mesmo assim"*. É a única
 * configuração destas telas que quebra outra tela.
 *
 * **O gênero é seguro aqui:** *categoria* e *área* são femininas, e *"Ela"* e *"reativá-la"* concordam com
 * o substantivo, não com uma pessoa.
 *
 * **O toque no aviso não fecha esta peça**, e ela não precisa da guarda do `dialog.tsx`: o primitivo
 * recusa fechamento por interação de fora.
 */

const CONTEUDO = "bg-superficie border-linha";
const BOTAO = "text-interface min-h-11 rounded-sm px-4";

export function SituacaoDoItem({
  lista,
  id,
  nome,
  ativa,
  ehUltimaAtiva,
  organizacaoId,
  descritoPor,
}: {
  readonly lista: Lista;
  readonly id: string;
  readonly nome: string;
  readonly ativa: boolean;
  readonly ehUltimaAtiva: boolean;
  readonly organizacaoId: string;
  /** O `id` do nome na linha, para o rótulo do botão não precisar repeti-lo. */
  readonly descritoPor?: string | undefined;
}) {
  const textos = textoDaSituacao(lista, nome, ativa, ehUltimaAtiva);

  const envio = useEnvioDoModal({
    enviar: async (): Promise<DesfechoDoEnvio<undefined>> => {
      const resposta = await fetch(`${TEXTOS_DA_LISTA[lista].endpoint}/${id}`, {
        method: "PATCH",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify({ ativa: !ativa }),
      });
      if (resposta.ok) return { ok: true };
      const corpo: unknown = await resposta.json().catch(() => null);
      return { ok: false, aviso: mensagemDoProblema(corpo, FRASES_DA_TELA[lista]) };
    },
    aoConcluir: () => avisoDeSituacao(lista, nome, !ativa),
    tituloDaFalha: falhaDaSituacao(ativa),
  });

  return (
    <AlertDialog open={envio.aberto} onOpenChange={envio.mudarAbertura}>
      <AlertDialogTrigger asChild>
        <BotaoDeIcone
          rotulo={ativa ? "Desativar" : "Reativar"}
          icone={ativa ? <EyeOff aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
          descritoPor={descritoPor}
        />
      </AlertDialogTrigger>
      <AlertDialogContent className={CONTEUDO}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-titulo-bloco text-tinta">
            {textos.titulo}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-corpo text-tinta-suave">
            {textos.corpo}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {textos.aviso !== null && (
          <p role="alert" className="bg-accent text-tinta text-interface rounded-md px-3.5 py-2.5 font-medium">
            {textos.aviso}
          </p>
        )}

        {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={envio.enviando} className={`border-linha ${BOTAO}`}>
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            variant={textos.destrutiva ? "destructive" : "marca"}
            disabled={envio.enviando}
            onClick={() => void envio.confirmar()}
            className={`${BOTAO} font-semibold`}
          >
            <IndicadorDeEnvio ativo={envio.enviando} />
            {envio.enviando ? textos.confirmando : textos.confirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
