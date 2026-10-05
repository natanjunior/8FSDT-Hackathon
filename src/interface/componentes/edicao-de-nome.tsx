"use client";

import { Pencil } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { Campo, ErroDoFormulario } from "@/interface/componentes/campo";
import { BotaoDeCancelar, BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import {
  EDICAO_DE_NOME,
  TETO_DO_NOME,
  erroDoNome,
  errosDoNomeNoCorpo,
  nomeDaResposta,
} from "@/interface/componentes/regras-do-nome";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado, type ErrosDeCampo } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  O modal do nome — T-15 e T-16, item 44i
 * ============================================================================
 *
 * **Um componente para as duas telas**, e o que muda entre elas é dado (`EDICAO_DE_NOME`, em
 * `regras-do-nome.ts`):
 *
 * ```tsx
 * <EdicaoDeNome alvo="organizacao" nome={…} organizacaoId={…} />
 * <EdicaoDeNome alvo="pessoa" nome={…} />
 * ```
 *
 * `organizacaoId` só existe no primeiro, e é obrigatório nele: `PATCH /organizacoes` afirma a organização
 * com que a aba renderizou (contrato §4.3). `PATCH /contexto/pessoa` roda fora do escopo (contrato §4.4):
 * renomear a si mesmo não é ato dentro de uma organização, e não há o que afirmar.
 *
 * **O componente desenha o gatilho e o modal.** O gatilho é *Editar*, que a página põe na cabeça do
 * cartão; o cartão continua de servidor. Estes dois componentes substituem os dois formulários de campo
 * aberto de T-15 e T-16, que eram o mesmo código duas vezes.
 *
 * **O envio segue a sequência de modal do guia §7**, pelo `useEnvioDoModal`: carregando no modal, com o
 * campo travado; sucesso com aviso, modal fechado e página atualizada; erro com aviso e mensagem no modal
 * aberto. **A atualização da página não é enfeite:** o seletor da barra superior imprime o nome da
 * organização, e o menu de pessoa imprime o nome e calcula as iniciais do avatar. Sem ela, a moldura
 * discordaria do conteúdo que acabou de mudar.
 *
 * **O campo segue o formulário tocado** (item 44g): abrir e fechar não acende nada; mudar o campo acende;
 * *Salvar* sem mudar acende *"Altere o nome antes de salvar."* e leva o foco ao campo. O botão nunca fica
 * desabilitado por campo inválido.
 *
 * **O erro do servidor.** A mensagem é a de `mensagemDoProblema`, sem frase própria: os códigos destes dois
 * endpoints têm `detail` escrito para gente. Sem resposta, a frase genérica, que o gancho dá quando o
 * envio lança. O `400` com erro em `nome` vai para baixo do campo, e nesse caso a caixa de erro do modal
 * não aparece: a mensagem já está onde a pessoa corrige.
 *
 * **O tamanho da letra do campo é o do catálogo**: 16 px no celular, que impede o navegador do iPhone de
 * ampliar a tela ao focar o campo.
 */

type Propriedades =
  | { readonly alvo: "organizacao"; readonly nome: string; readonly organizacaoId: string }
  | { readonly alvo: "pessoa"; readonly nome: string };

export function EdicaoDeNome(props: Propriedades) {
  const textos = EDICAO_DE_NOME[props.alvo];
  const campoId = useId();
  const [valor, setValor] = useState(props.nome);
  const [errosDoServidor, setErrosDoServidor] = useState<ErrosDeCampo>({});

  const formulario = useFormularioTocado({
    campos: { nome: campoId },
    erros: { nome: erroDoNome(props.alvo, valor, props.nome) },
  });

  async function enviar(): Promise<DesfechoDoEnvio<string>> {
    // **Vai o valor aparado**, como iam os formulários de campo aberto; o schema da rota apara de novo.
    const nome = valor.trim();
    const resposta = await fetch(textos.endpoint, {
      method: "PATCH",
      headers:
        props.alvo === "organizacao"
          ? cabecalhosDeEscrita(props.organizacaoId)
          : { "content-type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const corpo: unknown = await resposta.json().catch(() => null);
    if (resposta.ok) return { ok: true, valor: nomeDaResposta(corpo) ?? nome };

    // **A resposta recomeça o formulário** (a regra do 44g): o campo mudou antes do envio, e sem isto o
    // erro que o servidor pôs nele ficaria escondido.
    formulario.recomecar();
    setErrosDoServidor(errosDoNomeNoCorpo(corpo));
    return { ok: false, aviso: mensagemDoProblema(corpo) };
  }

  const envio = useEnvioDoModal<string>({
    enviar,
    aoConcluir: (nome) => textos.sucesso(nome ?? valor.trim()),
    tituloDaFalha: textos.falha,
    aoAbrir: () => {
      setValor(props.nome);
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
      titulo={textos.titulo}
      descricao={textos.descricao}
      obrigatorios={1}
      todosObrigatorios
      aoEnviar={aoEnviar}
      gatilho={
        /* **Principal** desde o item 64: é a única ação do cartão, em /meus-dados e em /configuracao. */
        <Button
          type="button"
          variant="marca"
          aria-label="Editar identidade"
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
      <Campo
        id={campoId}
        rotulo={textos.rotulo}
        obrigatorio
        ajuda={textos.ajuda}
        erro={formulario.erroDe("nome", errosDoServidor)}
        contador={{ usados: valor.length, maximo: TETO_DO_NOME }}
      >
        {(controle) => (
          <Input
            {...controle}
            value={valor}
            maxLength={TETO_DO_NOME}
            autoComplete={props.alvo === "pessoa" ? "name" : "organization"}
            disabled={envio.enviando}
            onChange={(evento) => {
              setValor(evento.target.value);
              formulario.mudou("nome");
            }}
            onBlur={formulario.aoSair("nome")}
            className="border-linha bg-background h-11"
          />
        )}
      </Campo>

      {envio.aviso !== null && errosDoServidor.nome === undefined && (
        <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>
      )}
    </Modal>
  );
}
