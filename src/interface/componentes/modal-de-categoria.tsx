"use client";

import { Pencil, Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { ICONE_PADRAO } from "@/dominio/organizacao";
import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { Campo, ErroDoFormulario } from "@/interface/componentes/campo";
import {
  FRASES_DA_TELA,
  TEXTOS_DA_LISTA,
  TEXTOS_DA_TABELA,
  TEXTOS_DO_MODAL,
  avisoDeAlterado,
  avisoDeCriado,
  erroDoNome,
  falhaAoCriar,
  FALHA,
} from "@/interface/componentes/frases-da-configuracao";
import { SeletorDeIcone } from "@/interface/componentes/icone-de-categoria";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import { errosDoNomeNoCorpo } from "@/interface/componentes/regras-do-nome";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { ICONES_DE_CATEGORIA, type NomeDeIcone } from "@/interface/schemas";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado, type ErrosDeCampo } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  T-09 · criar e editar categoria, em modal (item 44k, critério 5)
 * ============================================================================
 *
 * **Um componente nos dois modos**, no molde de `edicao-de-nome.tsx` (44i): o que muda é o gatilho — o
 * botão do cabeçalho em *criar*, o botão só com ícone da linha em *editar* — e o método.
 *
 * **O modal não tem *Ordem* nem *Situação***: a ordem se muda na lista, arrastando ou pelas setas, e a
 * situação tem confirmação própria. **Ninguém digita o número da ordem** em lugar nenhum do produto.
 *
 * **O corpo que vai ao servidor não manda `ordem`** — quem cria sem ela entra no fim, e é o servidor que
 * grava a posição (item 50).
 *
 * **O principal nunca fica desabilitado por campo inválido** (guia §7): clicado com problema, mostra o
 * erro e leva o foco ao campo.
 *
 * **O erro do servidor no campo `nome` vai para baixo do campo**, e nesse caso a caixa do modal não
 * aparece — a mensagem já está onde a pessoa corrige.
 */

type Props =
  | { readonly modo: "criar"; readonly organizacaoId: string }
  | {
      readonly modo: "editar";
      readonly organizacaoId: string;
      readonly descritoPor?: string | undefined;
      readonly categoria: { readonly id: string; readonly nome: string; readonly icone: string };
    };

/**
 * O valor salvo, degradado para o padrão quando não está na lista fechada: a coluna é `varchar(40)` com
 * `CHECK` de forma, e um `psql` administrativo pode ter gravado qualquer coisa (modelo §14.5).
 */
function iconeConhecido(nome: string): NomeDeIcone {
  return ICONES_DE_CATEGORIA.find((icone) => icone.nome === nome)?.nome ?? ICONE_PADRAO;
}

export function ModalDeCategoria(props: Props) {
  const textos = TEXTOS_DO_MODAL.categorias;
  const teto = TEXTOS_DA_LISTA.categorias.tetoDoNome;
  const prefixo = useId();
  const campoId = `${prefixo}-nome`;

  const nomeInicial = props.modo === "editar" ? props.categoria.nome : "";
  const iconeInicial = props.modo === "editar" ? iconeConhecido(props.categoria.icone) : ICONE_PADRAO;

  const [nome, setNome] = useState(nomeInicial);
  const [icone, setIcone] = useState<NomeDeIcone>(iconeInicial);
  const [errosDoServidor, setErrosDoServidor] = useState<ErrosDeCampo>({});

  const formulario = useFormularioTocado({
    campos: { nome: campoId },
    erros: { nome: erroDoNome("categorias", nome) },
  });

  const envio = useEnvioDoModal<string>({
    enviar: async (): Promise<DesfechoDoEnvio<string>> => {
      const aparado = nome.trim();
      const criando = props.modo === "criar";
      const corpo = criando
        ? { nome: aparado, icone }
        : {
            ...(aparado === props.categoria.nome ? {} : { nome: aparado }),
            ...(icone === props.categoria.icone ? {} : { icone }),
          };
      const resposta = await fetch(
        criando ? TEXTOS_DA_LISTA.categorias.endpoint : `${TEXTOS_DA_LISTA.categorias.endpoint}/${props.categoria.id}`,
        {
          method: criando ? "POST" : "PATCH",
          headers: cabecalhosDeEscrita(props.organizacaoId),
          body: JSON.stringify(corpo),
        },
      );
      if (resposta.ok) return { ok: true, valor: aparado };

      const problema: unknown = await resposta.json().catch(() => null);
      // A resposta recomeça o formulário (a regra do 44g): o campo mudou antes do envio, e sem isto o
      // erro que o servidor pôs nele ficaria escondido.
      formulario.recomecar();
      setErrosDoServidor(errosDoNomeNoCorpo(problema));
      return { ok: false, aviso: mensagemDoProblema(problema, FRASES_DA_TELA.categorias) };
    },
    aoConcluir: (valor) =>
      props.modo === "criar"
        ? avisoDeCriado("categorias", valor ?? nome.trim())
        : avisoDeAlterado("categorias", valor ?? nome.trim()),
    tituloDaFalha: props.modo === "criar" ? falhaAoCriar("categorias") : FALHA.salvar,
    aoAbrir: () => {
      setNome(nomeInicial);
      setIcone(iconeInicial);
      setErrosDoServidor({});
      formulario.recomecar();
    },
  });

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (envio.enviando || !formulario.tentarEnviar()) return;
    setErrosDoServidor({});
    void envio.confirmar();
  }

  return (
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      titulo={props.modo === "criar" ? textos.tituloDeCriar : textos.tituloDeEditar}
      descricao={props.modo === "criar" ? textos.descricaoDeCriar : textos.descricaoDeEditar}
      obrigatorios={1}
      todosObrigatorios
      aoEnviar={aoEnviar}
      gatilho={
        props.modo === "criar" ? (
          <Button
            type="button"
            variant="marca"
            className="text-interface min-h-11 rounded-sm px-4 font-semibold has-[>svg]:px-4"
          >
            <Plus aria-hidden="true" />
            {TEXTOS_DA_LISTA.categorias.acaoDeCriar}
          </Button>
        ) : (
          <BotaoDeIcone
            rotulo={TEXTOS_DA_TABELA.editar}
            icone={<Pencil aria-hidden="true" />}
            descritoPor={props.descritoPor}
          />
        )
      }
      rodape={
        <>
          <BotaoDeCancelar enviando={envio.enviando} />
          <BotaoDeConfirmar
            enviando={envio.enviando}
            rotulo={props.modo === "criar" ? textos.principalDeCriar : textos.principalDeEditar}
            rotuloEnviando={props.modo === "criar" ? textos.enviandoAoCriar : textos.enviandoAoSalvar}
          />
        </>
      }
    >
      <Campo
        id={campoId}
        rotulo={TEXTOS_DA_LISTA.categorias.rotuloDoNome}
        obrigatorio
        erro={formulario.erroDe("nome", errosDoServidor)}
        contador={{ usados: nome.length, maximo: teto }}
      >
        {(controle) => (
          <Input
            {...controle}
            value={nome}
            maxLength={teto}
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

      <SeletorDeIcone prefixo={prefixo} valor={icone} inerte={envio.enviando} aoEscolher={setIcone} />

      {envio.aviso !== null && errosDoServidor.nome === undefined && (
        <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>
      )}
    </Modal>
  );
}
