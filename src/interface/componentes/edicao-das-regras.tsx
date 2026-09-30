"use client";

import { Pencil } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { Campo, ErroDoFormulario } from "@/interface/componentes/campo";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import {
  APOIO_DOS_DIAS,
  APOIO_DO_LIMITE,
  DESCRICAO_DAS_REGRAS,
  DIAS_FORA_DA_FAIXA,
  REGRAS_SEM_MUDANCA,
  ROTULO_DA_REGRA,
  ROTULO_DO_CAMPO_DE_DIAS,
  TITULO_DAS_REGRAS,
  diasValidos,
  regrasQueMudaram,
  type Regras,
} from "@/interface/componentes/regras-da-configuracao";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { Switch } from "@/interface/componentes/ui/switch";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  O modal das regras do atendimento — T-15, item 99
 * ============================================================================
 *
 * **O cartão mostra, o modal edita** (item 44i, guia §7), como o cartão de Identidade. **Não é salvar na
 * mudança:** o único ponto do produto que grava sem confirmação é o seletor de prioridade (17.4), e ele
 * precisou de um *Desfazer* para isso. Aqui o modal já dá a confirmação.
 *
 * **Salvar sem mudar acende uma frase, e não desabilita o botão** — é a regra do critério 44g.9, a mesma
 * de `EdicaoDeNome`. Duas maneiras de tratar o mesmo gesto no mesmo produto seria pior que qualquer das
 * duas.
 *
 * **O corpo leva só o que mudou** (`regrasQueMudaram`): a rota recusa corpo vazio, e mandar o valor que já
 * está lá não deixaria rastro, mas diria ao servidor que houve uma escrita que não houve.
 *
 * **Acessibilidade:** cada interruptor está dentro de um `<label>` de verdade, com alvo de toque
 * `min-h-11`, e o segundo carrega o apoio por `aria-describedby`. O valor vai em palavra ao lado da
 * chave, nunca só na cor (A-5). O foco preso, o `Esc` e o foco devolvido ao gatilho vêm do `Dialog`.
 */
export function EdicaoDasRegras({
  regras,
  organizacaoId,
}: {
  regras: Regras;
  /** A organização com que a página renderizou — a afirmação da §4.3. */
  organizacaoId: string;
}) {
  const apoioDoLimiteId = useId();
  const campoDosDiasId = useId();
  const [escolhidas, setEscolhidas] = useState<Regras>(regras);
  // **O campo é texto, e não número**: `diasValidos` é quem decide o que vale, e um `number` no estado
  // não saberia representar *"a pessoa apagou o campo"*.
  const [dias, setDias] = useState(String(regras.diasParaParada));
  const [semMudanca, setSemMudanca] = useState(false);

  const formulario = useFormularioTocado({
    campos: { dias: campoDosDiasId },
    erros: { dias: diasValidos(dias) === null ? DIAS_FORA_DA_FAIXA : undefined },
  });

  async function enviar(): Promise<DesfechoDoEnvio<null>> {
    const resposta = await fetch("/api/configuracao", {
      method: "PATCH",
      headers: cabecalhosDeEscrita(organizacaoId),
      body: JSON.stringify(regrasQueMudaram(regras, escolhidas)),
    });
    if (resposta.ok) return { ok: true, valor: null };

    const corpo: unknown = await resposta.json().catch(() => null);
    return { ok: false, aviso: mensagemDoProblema(corpo) };
  }

  const envio = useEnvioDoModal<null>({
    enviar,
    aoConcluir: () => ({ titulo: "Regras salvas" }),
    tituloDaFalha: "Não foi possível salvar as regras",
    aoAbrir: () => {
      setEscolhidas(regras);
      setDias(String(regras.diasParaParada));
      setSemMudanca(false);
      formulario.recomecar();
    },
  });

  function trocar(mudanca: Partial<Regras>) {
    setEscolhidas((atual) => ({ ...atual, ...mudanca }));
    setSemMudanca(false);
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (envio.enviando) return;

    // **Fora da faixa nada é enviado**, e a recusa acende no campo: é o cenário *"dias fora da faixa"*.
    if (!formulario.tentarEnviar()) return;

    if (Object.keys(regrasQueMudaram(regras, escolhidas)).length === 0) {
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
      titulo={TITULO_DAS_REGRAS}
      descricao={DESCRICAO_DAS_REGRAS}
      obrigatorios={0}
      aoEnviar={aoEnviar}
      gatilho={
        <Button
          type="button"
          variant="marca"
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
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="text-interface text-tinta">
          {ROTULO_DA_REGRA.exigir_solucao_ao_resolver}
        </span>
        <Switch
          checked={escolhidas.exigirSolucaoAoResolver}
          disabled={envio.enviando}
          onCheckedChange={(ligado) => {
            trocar({ exigirSolucaoAoResolver: ligado });
          }}
          className="data-[state=checked]:bg-marca"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
          <span className="text-interface text-tinta">
            {ROTULO_DA_REGRA.limite_cancelamento_solicitante}
          </span>
          <Switch
            checked={escolhidas.limiteDeCancelamentoDoSolicitante === "em_atendimento"}
            disabled={envio.enviando}
            aria-describedby={apoioDoLimiteId}
            onCheckedChange={(ligado) => {
              trocar({ limiteDeCancelamentoDoSolicitante: ligado ? "em_atendimento" : "em_analise" });
            }}
            className="data-[state=checked]:bg-marca"
          />
        </label>
        <p id={apoioDoLimiteId} className="text-meta text-tinta-suave">
          {APOIO_DO_LIMITE}
        </p>
      </div>

      {/*
        **Campo numérico, e não seletor:** noventa opções não cabem num menu, e quem configura tem um
        número em mente. `inputMode="numeric"` traz o teclado certo no celular.
      */}
      <Campo
        id={campoDosDiasId}
        rotulo={ROTULO_DO_CAMPO_DE_DIAS}
        ajuda={APOIO_DOS_DIAS}
        erro={formulario.erroDe("dias")}
      >
        {(controle) => (
          <Input
            {...controle}
            inputMode="numeric"
            value={dias}
            maxLength={3}
            disabled={envio.enviando}
            onChange={(evento) => {
              const escolhido = evento.target.value;
              setDias(escolhido);
              setSemMudanca(false);
              formulario.mudou("dias");
              const valido = diasValidos(escolhido);
              if (valido !== null) trocar({ diasParaParada: valido });
            }}
            onBlur={formulario.aoSair("dias")}
            className="border-linha bg-background h-11 max-w-24"
          />
        )}
      </Campo>

      {semMudanca && <ErroDoFormulario>{REGRAS_SEM_MUDANCA}</ErroDoFormulario>}
      {!semMudanca && envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
