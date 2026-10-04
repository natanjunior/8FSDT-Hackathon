"use client";

import { Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { Campo, ErroDoFormulario } from "@/interface/componentes/campo";
import {
  LIMITE_DO_NOME,
  TEXTO_DO_LIMITE,
  reciboDaCriacao,
  type EtiquetaNaTela,
} from "@/interface/componentes/etiquetas-de-participante";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * **Nova etiqueta: o rótulo, e nada mais** (item 120, critério 19). Sem ícone e sem ordem, como decidiu o
 * 115. A normalização é a do banco — apara, ignora maiúscula, acento conta —, e o servidor reaproveita a
 * grafia igual em vez de recusar; o recibo diz qual dos dois aconteceu.
 */
export function ModalDeNovaEtiqueta({ organizacaoId }: { organizacaoId: string }) {
  const prefixo = useId();
  const campoId = `${prefixo}-nome`;
  const [nome, setNome] = useState("");

  const aparado = nome.trim();
  const erro =
    aparado.length === 0
      ? "Escreva o nome da etiqueta."
      : aparado.length > LIMITE_DO_NOME
        ? TEXTO_DO_LIMITE
        : undefined;
  const formulario = useFormularioTocado({ campos: { nome: campoId }, erros: { nome: erro } });

  const envio = useEnvioDoModal<{ etiqueta: EtiquetaNaTela; criada: boolean }>({
    enviar: async (): Promise<DesfechoDoEnvio<{ etiqueta: EtiquetaNaTela; criada: boolean }>> => {
      const resposta = await fetch("/api/etiquetas-de-participante", {
        method: "POST",
        headers: { "content-type": "application/json", ...cabecalhosDeEscrita(organizacaoId) },
        body: JSON.stringify({ nome: aparado }),
      });
      if (resposta.ok) return { ok: true, valor: (await resposta.json()) as { etiqueta: EtiquetaNaTela; criada: boolean } };
      return { ok: false, aviso: mensagemDoProblema(await resposta.json().catch(() => null)) };
    },
    aoConcluir: (valor) => ({ titulo: reciboDaCriacao(valor?.etiqueta.nome ?? aparado, valor?.criada ?? true) }),
    tituloDaFalha: "Não foi possível criar a etiqueta.",
    aoAbrir: () => {
      setNome("");
      formulario.recomecar();
    },
  });

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (envio.enviando || !formulario.tentarEnviar()) return;
    void envio.confirmar();
  }

  return (
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      titulo="Nova etiqueta"
      descricao="Um rótulo livre para dar aos participantes."
      obrigatorios={1}
      todosObrigatorios
      aoEnviar={aoEnviar}
      gatilho={
        <Button type="button" variant="marca" className="text-interface min-h-11 rounded-sm px-4 font-semibold has-[>svg]:px-4">
          <Plus aria-hidden="true" />
          Nova etiqueta
        </Button>
      }
      rodape={
        <>
          <BotaoDeCancelar enviando={envio.enviando} />
          <BotaoDeConfirmar enviando={envio.enviando} rotulo="Criar etiqueta" rotuloEnviando="Criando…" />
        </>
      }
    >
      <Campo
        id={campoId}
        rotulo="Nome"
        obrigatorio
        erro={formulario.erroDe("nome")}
        contador={{ usados: nome.length, maximo: LIMITE_DO_NOME }}
      >
        {(controle) => (
          <Input
            {...controle}
            value={nome}
            maxLength={LIMITE_DO_NOME}
            autoComplete="off"
            disabled={envio.enviando}
            onChange={(evento) => {
              setNome(evento.target.value);
              formulario.mudou("nome");
            }}
            onBlur={formulario.aoSair("nome")}
            className="border-linha bg-background h-11"
          />
        )}
      </Campo>
      {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
