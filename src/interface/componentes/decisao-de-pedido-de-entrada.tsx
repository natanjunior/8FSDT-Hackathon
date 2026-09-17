"use client";

import { Phone, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { CONTORNO_DE_ACAO } from "@/interface/componentes/botao-de-icone";
import { Campo, ErroDoFormulario, GrupoDeEscolha } from "@/interface/componentes/campo";
import { CampoDeUnidade, OpcoesDePapel, idDaOpcaoDePapel } from "@/interface/componentes/escolhas-do-vinculo";
import { FichaDePessoa } from "@/interface/componentes/ficha-de-pessoa";
import {
  FALHA,
  FRASES_DO_PEDIDO,
  TETO_DO_MOTIVO,
  TEXTOS_DA_RESPOSTA,
  avisoDeAprovado,
  avisoDeRecusado,
  avisoDoEncarregado,
  descricaoDaRecusa,
  descricaoDoPedido,
  erroDoPapelNaResposta,
  rotuloDeAprovar,
  tituloDaRecusa,
  type Papel,
} from "@/interface/componentes/frases-de-participantes";
import { BotaoDeConfirmar, Modal } from "@/interface/componentes/modal";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { telefoneLegivel } from "@/interface/componentes/telefone";
import { Button } from "@/interface/componentes/ui/button";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { cn } from "@/interface/componentes/utilitarios";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  T-08 · responder um pedido de entrada — o modal de duas faces (item 44j)
 * ============================================================================
 *
 * O **PA-25** nasceu de um erro de clique num seletor, e o conserto (`DELETE /vinculos/{pessoaId}`) é do
 * Gestor, enquanto quem precisa saber que deve procurá-lo é a pessoa aprovada com o papel errado. Daí as
 * três decisões que este componente materializa, na forma que o item 44j lhes deu:
 *
 * 1. **Nenhum papel pré-selecionado.** O principal **não** fica indisponível (guia §7): clicado sem
 *    papel, acende a mensagem e leva o foco à primeira opção.
 * 2. **O botão diz o papel** — *"Aprovar como Encarregado"*. Era o trabalho da confirmação separada, que
 *    saiu: a palavra aparece no mesmo lugar do clique, e não numa segunda tela.
 * 3. **A consequência está escrita onde a escolha é feita**, uma linha por papel, e escolher Encarregado
 *    abre o aviso dentro do modal.
 *
 * **Duas faces, uma raiz.** *Recusar pedido* troca o conteúdo do mesmo modal, com o papel e a unidade
 * guardados; *Voltar* devolve a primeira face. Um `alert-dialog` empilhado sobre o modal prenderia dois
 * focos, e um botão *Recusar* na linha não é o que a prancheta desenha.
 *
 * **O que o pedido carrega é o telefone informado** (contrato §4.6): `contatos` é tabela global, e
 * devolvê-la aqui mostraria ao Gestor desta organização o que a pessoa cadastrou em outra.
 *
 * **A sequência é a do guia §7**, pelo `useEnvioDoModal`: durante o envio nada fecha; sucesso avisa,
 * fecha e atualiza a página; erro avisa, deixa a mensagem no modal e o modal aberto. A mensagem do erro
 * continua à vista se a pessoa trocar de face — um `PEDIDO_JA_DECIDIDO` vale para as duas.
 */

type Face = "responder" | "recusar";

export function DecisaoDePedidoDeEntrada({
  pedido,
  areas,
  organizacaoId,
  aoSair,
}: {
  pedido: { id: string; pessoa: { nome: string; telefoneInformado: string | null }; criadoEm: string };
  areas: ReadonlyArray<{ id: string; nome: string }>;
  /** A organização com que a página renderizou — a afirmação do contrato §4.3. */
  organizacaoId: string;
  /** Para onde o foco vai quando a linha do pedido sai da tabela. */
  aoSair?: (() => void) | undefined;
}) {
  const nome = pedido.pessoa.nome;
  const prefixo = useId();
  const [face, setFace] = useState<Face>("responder");
  const [papel, setPapel] = useState<Papel | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [saiu, setSaiu] = useState(false);
  const trocouDeFace = useRef(false);
  const campoDoMotivo = useRef<HTMLTextAreaElement>(null);
  const botaoDeRecusar = useRef<HTMLButtonElement>(null);

  const respondendo = face === "responder";
  const unidade = areas.find((area) => area.id === areaId)?.nome ?? null;

  const formulario = useFormularioTocado({
    campos: { papel: idDaOpcaoDePapel(`${prefixo}-papel`, "solicitante") },
    erros: { papel: papel === null ? erroDoPapelNaResposta(nome) : undefined },
  });

  async function enviarPara(caminho: "aprovar" | "recusar", corpo: unknown): Promise<DesfechoDoEnvio<undefined>> {
    const resposta = await fetch(`/api/pedidos-de-entrada/${pedido.id}/${caminho}`, {
      method: "POST",
      headers: cabecalhosDeEscrita(organizacaoId),
      body: JSON.stringify(corpo),
    });
    if (resposta.ok) return { ok: true };
    const problema: unknown = await resposta.json().catch(() => null);
    return { ok: false, aviso: mensagemDoProblema(problema, FRASES_DO_PEDIDO) };
  }

  const envio = useEnvioDoModal({
    enviar: () =>
      respondendo
        ? enviarPara("aprovar", { papel, areaId })
        : enviarPara("recusar", { observacao: motivo.trim() === "" ? null : motivo }),
    aoConcluir: () => {
      setSaiu(true);
      return respondendo ? avisoDeAprovado(nome, papel ?? "", unidade) : avisoDeRecusado(nome);
    },
    tituloDaFalha: respondendo ? FALHA.aprovar : FALHA.recusar,
    aoAbrir: () => {
      setFace("responder");
      setPapel(null);
      setAreaId(null);
      setMotivo("");
      setSaiu(false);
      formulario.recomecar();
    },
  });

  // Trocar de face tira o foco do botão que sumiu: ele vai para o motivo, e volta para *Recusar pedido*.
  useEffect(() => {
    if (!trocouDeFace.current) return;
    trocouDeFace.current = false;
    if (face === "recusar") campoDoMotivo.current?.focus();
    else botaoDeRecusar.current?.focus();
  }, [face]);

  function trocarPara(proxima: Face) {
    trocouDeFace.current = true;
    setFace(proxima);
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (envio.enviando) return;
    if (respondendo && !formulario.tentarEnviar()) return;
    void envio.confirmar();
  }

  const aviso = papel === "encarregado" ? avisoDoEncarregado(nome) : null;

  return (
    <Modal
      aberto={envio.aberto}
      aoMudarAbertura={envio.mudarAbertura}
      enviando={envio.enviando}
      titulo={respondendo ? TEXTOS_DA_RESPOSTA.titulo : tituloDaRecusa(nome)}
      descricao={respondendo ? descricaoDoPedido(pedido.criadoEm) : descricaoDaRecusa(nome)}
      obrigatorios={respondendo ? 1 : 0}
      aoEnviar={aoEnviar}
      aoFecharFoco={(evento) => {
        if (!saiu) return;
        evento.preventDefault();
        setSaiu(false);
        aoSair?.();
      }}
      gatilho={
        <Button
          type="button"
          variant="outline"
          className={cn(CONTORNO_DE_ACAO, "text-interface text-tinta min-h-11 rounded-sm px-3.5")}
        >
          {TEXTOS_DA_RESPOSTA.gatilho}
          <span className="sr-only"> o pedido de {nome}</span>
        </Button>
      }
      rodape={
        respondendo ? (
          <>
            <Button
              ref={botaoDeRecusar}
              type="button"
              variant="destructive"
              disabled={envio.enviando}
              onClick={() => {
                trocarPara("recusar");
              }}
              className="text-interface min-h-11 rounded-sm px-4 font-semibold"
            >
              {TEXTOS_DA_RESPOSTA.recusar}
            </Button>
            <BotaoDeConfirmar
              enviando={envio.enviando}
              rotulo={rotuloDeAprovar(papel)}
              rotuloEnviando={TEXTOS_DA_RESPOSTA.aprovando}
            />
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={envio.enviando}
              onClick={() => {
                trocarPara("responder");
              }}
              className={cn(CONTORNO_DE_ACAO, "text-interface text-tinta min-h-11 rounded-sm px-4")}
            >
              {TEXTOS_DA_RESPOSTA.voltar}
            </Button>
            <BotaoDeConfirmar
              enviando={envio.enviando}
              rotulo={TEXTOS_DA_RESPOSTA.recusar}
              rotuloEnviando={TEXTOS_DA_RESPOSTA.recusando}
              variante="destrutiva"
            />
          </>
        )
      }
    >
      {respondendo ? (
        <>
          <div className="border-linha-suave bg-background flex flex-col gap-1 rounded-lg border px-3.5 py-3">
            <FichaDePessoa nome={nome} tamanho="linha" />
            <p className="text-meta text-tinta-suave flex items-center gap-1.5 pl-[38px]">
              {pedido.pessoa.telefoneInformado === null ? (
                TEXTOS_DA_RESPOSTA.semTelefone
              ) : (
                <>
                  <Phone aria-hidden="true" className="size-3.5 shrink-0" />
                  {telefoneLegivel(pedido.pessoa.telefoneInformado)}
                </>
              )}
            </p>
          </div>

          <GrupoDeEscolha
            id={`${prefixo}-grupo`}
            legenda={TEXTOS_DA_RESPOSTA.legenda}
            obrigatorio
            erro={formulario.erroDe("papel")}
          >
            <OpcoesDePapel
              id={`${prefixo}-papel`}
              rotulo={TEXTOS_DA_RESPOSTA.legenda}
              valor={papel}
              inerte={envio.enviando}
              aoMudar={(escolhido) => {
                setPapel(escolhido);
                formulario.mudou("papel");
              }}
            />
          </GrupoDeEscolha>

          {/* **Não é região viva:** ele aparece por causa de uma escolha da própria pessoa, logo abaixo
              dela. As cores são as do tema: o guia §2 não abre cor nova. */}
          {aviso !== null && (
            <div className="border-linha bg-background text-interface text-tinta-suave flex gap-2.5 rounded-lg border px-3.5 py-2.5">
              <TriangleAlert aria-hidden="true" className="text-tinta-suave mt-0.5 size-4 shrink-0" />
              <p>
                <strong className="text-tinta font-semibold">{aviso.destaque}</strong> {aviso.resto}
              </p>
            </div>
          )}

          <CampoDeUnidade
            id={`${prefixo}-unidade`}
            valor={areaId}
            areas={areas}
            inerte={envio.enviando}
            aoMudar={setAreaId}
          />
        </>
      ) : (
        <Campo
          id={`${prefixo}-motivo`}
          rotulo={TEXTOS_DA_RESPOSTA.motivo}
          ajuda={TEXTOS_DA_RESPOSTA.ajudaDoMotivo}
          contador={{ usados: motivo.length, maximo: TETO_DO_MOTIVO }}
        >
          {(controle) => (
            <Textarea
              {...controle}
              ref={campoDoMotivo}
              value={motivo}
              maxLength={TETO_DO_MOTIVO}
              rows={3}
              disabled={envio.enviando}
              onChange={(evento) => {
                setMotivo(evento.target.value);
              }}
              className="border-linha bg-background min-h-20"
            />
          )}
        </Campo>
      )}

      {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
    </Modal>
  );
}
