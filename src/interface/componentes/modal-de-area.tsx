"use client";

import { Pencil, Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { Campo, ErroDoFormulario, GrupoDeEscolha } from "@/interface/componentes/campo";
import {
  AVISO_DE_TIPO_NO_MODAL,
  ERRO_DO_TIPO,
  FALHA,
  FRASES_DA_TELA,
  OS_DOIS_TIPOS,
  TEXTOS_DA_LISTA,
  TEXTOS_DA_TABELA,
  TEXTOS_DO_MODAL,
  avisoDaMudancaDeTipo,
  avisoDeAlterado,
  avisoDeCriado,
  erroDoNome,
  falhaAoCriar,
  tipoDoValor,
  type TipoDeArea,
} from "@/interface/componentes/frases-da-configuracao";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import { errosDoNomeNoCorpo } from "@/interface/componentes/regras-do-nome";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { RadioGroup, RadioGroupItem } from "@/interface/componentes/ui/radio-group";
import { cn } from "@/interface/componentes/utilitarios";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado, type ErrosDeCampo } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  T-14 · criar e editar área, em modal (item 44k, critérios 5 e 8)
 * ============================================================================
 *
 * O mesmo modal de T-09, com duas diferenças: **o tipo obrigatório em `radio-group`** e **o aviso da
 * mudança de tipo**.
 *
 * **Nenhum tipo vem marcado na criação** — é o mecanismo do PA-25 que o item 5 já materializou: *não
 * existe valor que se obtém por não escolher*. Na edição, a opção que é o tipo de hoje leva *"· tipo
 * atual"* ao lado do rótulo.
 *
 * **O exemplo de cada tipo fica embaixo do rótulo, nunca em dica de ponteiro** (compromisso A-6).
 *
 * **O campo `tipo` aponta para o `id` da primeira opção**, e não para o `fieldset`: o `RadioGroupItem` do
 * `radix-ui` desenha um rádio escondido, e o `focar` de `useFormularioTocado` procura
 * `input[type="radio"]` antes de qualquer botão. É o desvio que o 44j já usou; o conserto definitivo do
 * gancho é do 44g, porque mexer nele mexe em seis telas.
 *
 * **O aviso da mudança de tipo aparece dentro do modal, sem número**, assim que o tipo escolhido difere do
 * atual. **Não é região viva:** ele aparece por causa de uma escolha da própria pessoa, logo abaixo dela.
 * Depois de salvar, quem carrega a contagem é o aviso de atenção, que fica até ser fechado.
 */

type Props =
  | { readonly modo: "criar"; readonly organizacaoId: string }
  | {
      readonly modo: "editar";
      readonly organizacaoId: string;
      readonly descritoPor?: string | undefined;
      readonly area: { readonly id: string; readonly nome: string; readonly tipo: string };
    };

/** A resposta de `PATCH /areas/{id}`: o schema `Area` mais a contagem que só existe para a frase. */
type AreaCorrigida = { readonly nome: string; readonly tipo: string; readonly contagem: number };

function idDaOpcao(prefixo: string, tipo: TipoDeArea): string {
  return `${prefixo}-tipo-${tipo}`;
}

export function ModalDeArea(props: Props) {
  const textos = TEXTOS_DO_MODAL.areas;
  const teto = TEXTOS_DA_LISTA.areas.tetoDoNome;
  const prefixo = useId();
  const campoId = `${prefixo}-nome`;

  const nomeInicial = props.modo === "editar" ? props.area.nome : "";
  const tipoInicial = props.modo === "editar" ? tipoDoValor(props.area.tipo) : null;

  const [nome, setNome] = useState(nomeInicial);
  const [tipo, setTipo] = useState<TipoDeArea | null>(tipoInicial);
  const [errosDoServidor, setErrosDoServidor] = useState<ErrosDeCampo>({});

  const formulario = useFormularioTocado({
    campos: { nome: campoId, tipo: idDaOpcao(prefixo, "comum") },
    erros: {
      nome: erroDoNome("areas", nome),
      tipo: tipo === null ? ERRO_DO_TIPO : undefined,
    },
  });

  const mudouOTipo = props.modo === "editar" && tipo !== null && tipo !== props.area.tipo;

  const envio = useEnvioDoModal<AreaCorrigida>({
    enviar: async (): Promise<DesfechoDoEnvio<AreaCorrigida>> => {
      if (tipo === null) return { ok: false, aviso: ERRO_DO_TIPO };
      const aparado = nome.trim();
      const criando = props.modo === "criar";
      const corpo = criando
        ? { nome: aparado, tipo }
        : {
            ...(aparado === props.area.nome ? {} : { nome: aparado }),
            ...(tipo === props.area.tipo ? {} : { tipo }),
          };
      const resposta = await fetch(
        criando ? TEXTOS_DA_LISTA.areas.endpoint : `${TEXTOS_DA_LISTA.areas.endpoint}/${props.area.id}`,
        {
          method: criando ? "POST" : "PATCH",
          headers: cabecalhosDeEscrita(props.organizacaoId),
          body: JSON.stringify(corpo),
        },
      );
      const devolvido: unknown = await resposta.json().catch(() => null);
      if (resposta.ok) {
        const { ocorrenciasComTipoAnterior } = (devolvido ?? {}) as {
          ocorrenciasComTipoAnterior?: unknown;
        };
        return {
          ok: true,
          valor: {
            nome: aparado,
            tipo,
            contagem: typeof ocorrenciasComTipoAnterior === "number" ? ocorrenciasComTipoAnterior : 0,
          },
        };
      }

      formulario.recomecar();
      setErrosDoServidor(errosDoNomeNoCorpo(devolvido));
      return { ok: false, aviso: mensagemDoProblema(devolvido, FRASES_DA_TELA.areas) };
    },
    aoConcluir: (valor) => {
      const salvo = valor ?? { nome: nome.trim(), tipo: tipo ?? "", contagem: 0 };
      if (props.modo === "criar") return avisoDeCriado("areas", salvo.nome);
      if (!mudouOTipo) return avisoDeAlterado("areas", salvo.nome);
      return avisoDaMudancaDeTipo(salvo.nome, salvo.tipo, salvo.contagem);
    },
    tituloDaFalha: props.modo === "criar" ? falhaAoCriar("areas") : FALHA.salvar,
    aoAbrir: () => {
      setNome(nomeInicial);
      setTipo(tipoInicial);
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
      obrigatorios={2}
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
            {TEXTOS_DA_LISTA.areas.acaoDeCriar}
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
        rotulo={TEXTOS_DA_LISTA.areas.rotuloDoNome}
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

      <GrupoDeEscolha
        id={`${prefixo}-grupo-tipo`}
        legenda={TEXTOS_DA_TABELA.tipo}
        obrigatorio
        aoSair={formulario.aoSair("tipo")}
        erro={formulario.erroDe("tipo")}
      >
        <RadioGroup
          aria-label={TEXTOS_DA_TABELA.tipo}
          value={tipo ?? ""}
          disabled={envio.enviando}
          onValueChange={(escolhido) => {
            const proximo = tipoDoValor(escolhido);
            if (proximo === null) return;
            setTipo(proximo);
            formulario.mudou("tipo");
          }}
          className="gap-2"
        >
          {OS_DOIS_TIPOS.map((opcao) => (
            <label
              key={opcao.valor}
              htmlFor={idDaOpcao(prefixo, opcao.valor)}
              className={cn(
                "border-linha bg-background flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5",
                "has-[[data-state=checked]]:border-marca has-[[data-state=checked]]:bg-marca/[7%]",
                "group-data-invalido:border-destructive/[75%]",
              )}
            >
              <RadioGroupItem
                id={idDaOpcao(prefixo, opcao.valor)}
                value={opcao.valor}
                className="border-tinta-fraca text-tinta-marca data-[state=checked]:border-marca mt-0.5 [&_svg]:fill-tinta-marca"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-interface text-tinta font-semibold">
                  {opcao.rotulo}
                  {props.modo === "editar" && props.area.tipo === opcao.valor && (
                    <span className="text-tinta-suave font-normal"> · tipo atual</span>
                  )}
                </span>
                <span className="text-meta text-tinta-suave">{opcao.exemplo}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </GrupoDeEscolha>

      {mudouOTipo && (
        <p className="border-linha bg-background text-interface text-tinta rounded-lg border px-3.5 py-2.5">
          {AVISO_DE_TIPO_NO_MODAL}
        </p>
      )}

      {envio.aviso !== null && errosDoServidor.nome === undefined && (
        <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>
      )}
    </Modal>
  );
}
