"use client";

import { Pencil } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { Campo, ErroDoFormulario } from "@/interface/componentes/campo";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import {
  APOIO_DA_PAUSA,
  AVISO_DE_ROTULOS_SALVOS,
  DESCRICAO_DOS_ROTULOS,
  ESTADOS_DO_CICLO,
  FALHA_AO_SALVAR_ROTULOS,
  NOME_DO_CICLO,
  ROTULOS_SEM_MUDANCA,
  TETO_DO_ROTULO,
  TITULO_DOS_ROTULOS,
  rotulosQueMudaram,
  type EstadoDaTela,
  type Rotulos,
} from "@/interface/componentes/rotulos-do-solicitante";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";

/**
 * ============================================================================
 *  O modal dos textos de quem abriu — T-15, item 100
 * ============================================================================
 *
 * **O cartão mostra, o modal edita** (item 44i, guia §7), como os cartões de Identidade e de Regras.
 *
 * **Seis campos em pilha, e não uma tabela:** é o que os mantém legíveis em 360 px sem rolagem lateral, a
 * mesma decisão que a pilha da trilha do item 99.
 *
 * **Os padrões descem prontos do Server Component**, como *placeholder* de cada campo. O navegador não
 * monta rótulo — é a mesma regra que faz os dois mapas de `rotulos.ts` descerem prontos para T-05.
 *
 * **Salvar sem mudar acende uma frase, e não desabilita o botão** — é a regra do critério 44g.9, a mesma
 * de `EdicaoDeNome` e de `EdicaoDasRegras`.
 *
 * **O corpo leva só o que mudou** (`rotulosQueMudaram`): a rota recusa corpo vazio, e mandar o texto que
 * já está lá diria ao servidor que houve uma escrita que não houve.
 */
export function EdicaoDosRotulos({
  rotulos,
  padroes,
  organizacaoId,
}: {
  /** Só o que a organização customizou. Estado ausente é *"vale o padrão"*. */
  rotulos: Rotulos;
  /** O texto padrão de cada ponto do ciclo, para o *placeholder*. */
  padroes: Readonly<Record<EstadoDaTela, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3. */
  organizacaoId: string;
}) {
  const prefixo = useId();
  const [escolhidos, setEscolhidos] = useState<Rotulos>(rotulos);
  const [semMudanca, setSemMudanca] = useState(false);

  async function enviar(): Promise<DesfechoDoEnvio<null>> {
    const resposta = await fetch("/api/configuracao", {
      method: "PATCH",
      headers: cabecalhosDeEscrita(organizacaoId),
      body: JSON.stringify({ rotulosDoSolicitante: rotulosQueMudaram(rotulos, escolhidos) }),
    });
    if (resposta.ok) return { ok: true, valor: null };

    const corpo: unknown = await resposta.json().catch(() => null);
    return { ok: false, aviso: mensagemDoProblema(corpo) };
  }

  const envio = useEnvioDoModal<null>({
    enviar,
    aoConcluir: () => ({ titulo: AVISO_DE_ROTULOS_SALVOS }),
    tituloDaFalha: FALHA_AO_SALVAR_ROTULOS,
    aoAbrir: () => {
      setEscolhidos(rotulos);
      setSemMudanca(false);
    },
  });

  function trocar(estado: EstadoDaTela, texto: string) {
    setEscolhidos((atual) => ({ ...atual, [estado]: texto }));
    setSemMudanca(false);
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (envio.enviando) return;

    if (Object.keys(rotulosQueMudaram(rotulos, escolhidos)).length === 0) {
      setSemMudanca(true);
      return;
    }

    setSemMudanca(false);
    void envio.confirmar();
  }

  return (
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      titulo={TITULO_DOS_ROTULOS}
      descricao={DESCRICAO_DOS_ROTULOS}
      obrigatorios={0}
      aoEnviar={aoEnviar}
      gatilho={
        <Button
          type="button"
          variant="marca"
          aria-label="Editar textos do Solicitante"
          className="text-interface min-h-11 rounded-sm px-4 has-[>svg]:px-4"
        >
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      }
      rodape={
        <>
          <BotaoDeCancelar enviando={envio.enviando} />
          <BotaoDeConfirmar enviando={envio.enviando} rotulo="Salvar" rotuloEnviando="Salvando…" />
        </>
      }
    >
      {ESTADOS_DO_CICLO.map((estado) => {
        const valor = escolhidos[estado] ?? "";
        return (
          <Campo
            key={estado}
            id={`${prefixo}-${estado}`}
            rotulo={NOME_DO_CICLO[estado]}
            {...(estado === "pausada" ? { ajuda: APOIO_DA_PAUSA } : {})}
            contador={{ usados: valor.length, maximo: TETO_DO_ROTULO }}
          >
            {(controle) => (
              <Input
                {...controle}
                value={valor}
                placeholder={padroes[estado]}
                maxLength={TETO_DO_ROTULO}
                disabled={envio.enviando}
                onChange={(evento) => {
                  trocar(estado, evento.target.value);
                }}
                className="border-linha bg-background h-11"
              />
            )}
          </Campo>
        );
      })}

      {semMudanca && <ErroDoFormulario>{ROTULOS_SEM_MUDANCA}</ErroDoFormulario>}
      {!semMudanca && envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
