"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { CONTORNO_DE_ACAO } from "@/interface/componentes/botao-de-icone";
import { Campo, ErroDoFormulario, GrupoDeEscolha, RodapeDaPagina } from "@/interface/componentes/campo";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import { CampoDeUnidade, OpcoesDePapel, idDaOpcaoDePapel } from "@/interface/componentes/escolhas-do-vinculo";
import {
  FALHA,
  FRASES_DO_FORMULARIO,
  TEXTOS_DO_FORMULARIO,
  avisoDeCadastrado,
  avisoDeSalvo,
  rotuloDoPapel,
  type Papel,
} from "@/interface/componentes/frases-de-participantes";
import { BotaoDeConfirmar } from "@/interface/componentes/modal";
import { TETO_DO_NOME } from "@/interface/componentes/regras-do-nome";
import {
  campoDoContato,
  contatoEmLeitura,
  contatoVindoDaApi,
  corpoDaCorrecao,
  corpoDoCadastro,
  edicaoMudou,
  errosDoFormularioDeVinculo,
  errosDoServidorNoFormulario,
  idDoContato,
  type ContatoDaApi,
  type ContatoEmEdicao,
} from "@/interface/componentes/regras-do-vinculo";
import {
  MENSAGEM_GENERICA,
  avisarConclusao,
  avisarErro,
  mensagemDoProblema,
} from "@/interface/componentes/retorno-de-acao";
import { SubFormularioDeContatos } from "@/interface/componentes/sub-formulario-de-contatos";
import { buttonVariants } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { cn } from "@/interface/componentes/utilitarios";
import { useFormularioTocado, type ErrosDeCampo } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  T-08 · cadastrar participante, e editar participante — item 44j
 * ============================================================================
 *
 * **Página própria, pela exceção do guia §7**, declarada em 16/09/2026: o sub-formulário de contatos é
 * repetível e reordenável, e a página de edição é a que um dia serviria a uma página de detalhes da
 * pessoa. O rodapé é o mesmo do modal, preso ao fim da área de conteúdo, e é a única saída além do
 * caminho no topo.
 *
 * **Este formulário não está sob o RNF6.** É trabalho de escritório, feito sentado, uma vez — o orçamento
 * de 60 segundos é de T-04. Aqui a completude vale mais que a velocidade.
 *
 * **O papel não aparece na edição**, e isso não é omissão: `PATCH /vinculos/{pessoaId}` não o aceita, e o
 * único conserto de papel errado é remover o vínculo e refazer o pedido. **Quem tem conta lê nome e
 * contatos e edita só a unidade**: os dois primeiros são globais, e o Gestor desta organização não os
 * altera nas outras. A tela não explica o que não oferece (guia §7, *Texto de tela*).
 *
 * **A sequência é a do guia, adaptada à página** (critério 10): durante o envio o principal mostra o
 * indicador e os controles ficam inertes; no sucesso sai o aviso e a página vai para a lista; no erro sai
 * o aviso, a mensagem aparece no fim do formulário — ou embaixo do campo, quando o servidor disse qual — e
 * o formulário fica como estava.
 *
 * **O cliente valida com o mesmo schema da rota** (`regras-do-vinculo.ts`), e o botão principal nunca
 * fica desabilitado por campo inválido.
 */

type Modo =
  | { readonly tipo: "cadastro" }
  | {
      readonly tipo: "correcao";
      readonly pessoaId: string;
      readonly nome: string;
      readonly papel: string;
      readonly temConta: boolean;
      readonly areaIdAtual: string | null;
      readonly contatosAtuais: readonly ContatoDaApi[];
    };

export function FormularioDeVinculo({
  modo,
  areas,
  organizacaoId,
  depoisDosContatos,
}: {
  modo: Modo;
  areas: ReadonlyArray<{ id: string; nome: string }>;
  /** A organização com que a página renderizou — a afirmação do contrato §4.3. */
  organizacaoId: string;
  /**
   * **O que vem entre Contatos e o rodapé, fora do `<form>`** (item 120): o cartão de etiquetas, que grava
   * a cada gesto. Fora do elemento, `Enter` dentro dele não envia o formulário, e o botão de salvar se liga
   * pelo atributo `form`.
   */
  depoisDosContatos?: ReactNode;
}) {
  const router = useRouter();
  const prefixo = useId();

  const cadastro = modo.tipo === "cadastro";
  const editaNomeEContatos = modo.tipo === "cadastro" || !modo.temConta;
  const nomeOriginal = modo.tipo === "correcao" ? modo.nome : "";
  const areaOriginal = modo.tipo === "correcao" ? modo.areaIdAtual : null;
  // Recalculado a cada renderização de propósito: é só a lista de referência da comparação, e as
  // propriedades desta tela não mudam sem remontar a página.
  const originais = modo.tipo === "correcao" ? modo.contatosAtuais.map(contatoVindoDaApi) : [];

  const [nome, setNome] = useState(nomeOriginal);
  const [papel, setPapel] = useState<Papel | null>(null);
  const [areaId, setAreaId] = useState<string | null>(areaOriginal);
  const [contatos, setContatos] = useState<readonly ContatoEmEdicao[]>(originais);
  const [enviando, setEnviando] = useState(false);
  const [errosDoServidor, setErrosDoServidor] = useState<ErrosDeCampo>({});
  const [avisoDoServidor, setAvisoDoServidor] = useState<string | null>(null);
  const [tentouSemMudanca, setTentouSemMudanca] = useState(false);

  const idDoNome = `${prefixo}-nome`;
  const idDoPapel = `${prefixo}-papel`;
  const idDoFormulario = `${prefixo}-formulario`;

  // A ordem das chaves é a do documento: é ela que decide para onde o foco vai no envio com problema.
  const campos: Record<string, string> = {};
  if (editaNomeEContatos) campos["nome"] = idDoNome;
  if (cadastro) campos["papel"] = idDaOpcaoDePapel(idDoPapel, "solicitante");
  if (editaNomeEContatos) {
    for (const contato of contatos) {
      campos[campoDoContato(contato.chave)] = idDoContato(prefixo, contato.chave, "valor");
    }
  }

  const erros = errosDoFormularioDeVinculo({
    modo: modo.tipo,
    editaNomeEContatos,
    nome,
    papel,
    contatos,
  });
  const formulario = useFormularioTocado({ campos, erros });

  const mudou =
    cadastro ||
    edicaoMudou({ editaNomeEContatos, nomeOriginal, nome, areaOriginal, areaId, originais, contatos });
  const mensagem = tentouSemMudanca && !mudou ? TEXTOS_DO_FORMULARIO.semMudanca : avisoDoServidor;
  const obrigatorios = (editaNomeEContatos ? 1 + contatos.length : 0) + (cadastro ? 1 : 0);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || !formulario.tentarEnviar()) return;
    if (!mudou) {
      setTentouSemMudanca(true);
      return;
    }

    const corpo =
      modo.tipo === "cadastro"
        ? papel === null
          ? null
          : corpoDoCadastro({ nome, papel, areaId, contatos })
        : corpoDaCorrecao({ editaNomeEContatos, nome, areaId, contatos, originais });
    // O formulário tocado já acendeu o problema que impediu o corpo de ficar pronto.
    if (corpo === null) return;

    const falha = cadastro ? FALHA.cadastrar : FALHA.salvar;
    setEnviando(true);
    setAvisoDoServidor(null);
    setErrosDoServidor({});
    setTentouSemMudanca(false);

    try {
      const resposta = await fetch(
        modo.tipo === "cadastro" ? "/api/vinculos" : `/api/vinculos/${modo.pessoaId}`,
        {
          method: modo.tipo === "cadastro" ? "POST" : "PATCH",
          headers: cabecalhosDeEscrita(organizacaoId),
          body: JSON.stringify(corpo),
        },
      );
      const problema: unknown = await resposta.json().catch(() => null);

      if (resposta.ok) {
        const nomeDoAviso = editaNomeEContatos ? nome.trim() : nomeOriginal;
        avisarConclusao(
          modo.tipo === "cadastro" && papel !== null
            ? avisoDeCadastrado(nomeDoAviso, papel)
            : avisoDeSalvo(nomeDoAviso),
        );
        // `replace`: voltar pelo navegador não reencontra o formulário já enviado.
        router.replace("/vinculos");
        router.refresh();
        return;
      }

      // **A resposta recomeça o formulário** (a regra do 44g): sem isto, o erro que o servidor pôs num
      // campo que a pessoa já tinha mexido ficaria escondido.
      formulario.recomecar();
      setErrosDoServidor(errosDoServidorNoFormulario(problema, contatos));
      setAvisoDoServidor(mensagemDoProblema(problema, FRASES_DO_FORMULARIO));
      avisarErro(falha);
    } catch {
      // `fetch` rejeitou antes de haver resposta — a rede caiu. Sem este `catch` a rejeição sobe pela
      // fronteira do React e a pessoa vê a tela de erro do framework no lugar de uma frase.
      setAvisoDoServidor(MENSAGEM_GENERICA);
      avisarErro(falha);
    }
    setEnviando(false);
  }

  const campoDoNome = (
    <Campo
      id={idDoNome}
      rotulo={TEXTOS_DO_FORMULARIO.nome}
      obrigatorio
      ajuda={TEXTOS_DO_FORMULARIO.ajudaDoNome}
      erro={formulario.erroDe("nome", errosDoServidor)}
      contador={{ usados: nome.length, maximo: TETO_DO_NOME }}
    >
      {(controle) => (
        <Input
          {...controle}
          value={nome}
          maxLength={TETO_DO_NOME}
          autoComplete="off"
          disabled={enviando}
          onChange={(evento) => {
            setNome(evento.target.value);
            formulario.mudou("nome");
          }}
          onBlur={formulario.aoSair("nome")}
          className="border-linha bg-background h-11"
        />
      )}
    </Campo>
  );

  const campoDaUnidade = (
    <CampoDeUnidade
      id={`${prefixo}-unidade`}
      valor={areaId}
      areas={areas}
      inerte={enviando}
      aoMudar={setAreaId}
    />
  );

  return (
    <div className="flex flex-col gap-5.5">
      <form id={idDoFormulario} noValidate onSubmit={(evento) => void enviar(evento)} className="flex flex-col gap-5.5">
        <Cartao tituloId={`${prefixo}-pessoa`}>
          <CabecaDoCartao id={`${prefixo}-pessoa`} titulo={TEXTOS_DO_FORMULARIO.cartaoPessoa} />
          {modo.tipo === "cadastro" ? (
            <div className="flex flex-col gap-4.5 p-[15px] md:p-[18px]">
              <div className="grid gap-4.5 lg:grid-cols-2">
                {campoDoNome}
                {campoDaUnidade}
              </div>
              <GrupoDeEscolha
                id={`${idDoPapel}-grupo`}
                legenda={TEXTOS_DO_FORMULARIO.papel}
                obrigatorio
                aoSair={formulario.aoSair("papel")}
                erro={formulario.erroDe("papel")}
              >
                <OpcoesDePapel
                  id={idDoPapel}
                  rotulo={TEXTOS_DO_FORMULARIO.papel}
                  valor={papel}
                  inerte={enviando}
                  emColunas
                  aoMudar={(escolhido) => {
                    setPapel(escolhido);
                    formulario.mudou("papel");
                  }}
                />
              </GrupoDeEscolha>
            </div>
          ) : (
            <div className="grid md:grid-cols-3">
              <div className="p-[15px] md:p-[18px]">
                {modo.temConta ? <Leitura rotulo={TEXTOS_DO_FORMULARIO.nome} valor={modo.nome} /> : campoDoNome}
              </div>
              <div className="border-linha-suave border-t p-[15px] md:border-t-0 md:border-l md:p-[18px]">
                {campoDaUnidade}
              </div>
              <div className="border-linha-suave border-t p-[15px] md:border-t-0 md:border-l md:p-[18px]">
                <Leitura rotulo={TEXTOS_DO_FORMULARIO.papel} valor={rotuloDoPapel(modo.papel)} />
              </div>
            </div>
          )}
        </Cartao>

        <Cartao tituloId={`${prefixo}-contatos`}>
          <CabecaDoCartao
            id={`${prefixo}-contatos`}
            titulo={TEXTOS_DO_FORMULARIO.cartaoContatos}
            apoio={editaNomeEContatos ? <ApoioDaOrdem /> : undefined}
          />
          {editaNomeEContatos ? (
            <SubFormularioDeContatos
              prefixo={prefixo}
              contatos={contatos}
              inerte={enviando}
              aoMudar={setContatos}
              aoMudarValor={(chave) => {
                formulario.mudou(campoDoContato(chave));
              }}
              aoSairDoValor={(chave) => formulario.aoSair(campoDoContato(chave))}
              erroDoValor={(chave) => formulario.erroDe(campoDoContato(chave), errosDoServidor)}
            />
          ) : (
            <ContatosEmLeitura contatos={modo.tipo === "correcao" ? modo.contatosAtuais : []} />
          )}
        </Cartao>

        {mensagem !== null && <ErroDoFormulario>{mensagem}</ErroDoFormulario>}
      </form>

      {depoisDosContatos}

      <RodapeDaPagina obrigatorios={obrigatorios}>
        <Link
          href="/vinculos"
          aria-disabled={enviando || undefined}
          tabIndex={enviando ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "outline" }),
            CONTORNO_DE_ACAO,
            "text-interface text-tinta min-h-11 rounded-sm px-4",
            enviando && "pointer-events-none opacity-50",
          )}
        >
          {TEXTOS_DO_FORMULARIO.cancelar}
        </Link>
        <BotaoDeConfirmar
          enviando={enviando}
          rotulo={cadastro ? TEXTOS_DO_FORMULARIO.cadastrar : TEXTOS_DO_FORMULARIO.salvar}
          rotuloEnviando={cadastro ? TEXTOS_DO_FORMULARIO.cadastrando : TEXTOS_DO_FORMULARIO.salvando}
          formulario={idDoFormulario}
        />
      </RodapeDaPagina>
    </div>
  );
}

/** Onde não se arrasta, a frase não promete arrastar. */
function ApoioDaOrdem() {
  return (
    <>
      <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">
        {TEXTOS_DO_FORMULARIO.apoioComAlca}
      </span>
      <span className="[@media(hover:hover)_and_(pointer:fine)]:hidden">
        {TEXTOS_DO_FORMULARIO.apoioSemAlca}
      </span>
    </>
  );
}

function Leitura({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <dl className="flex flex-col gap-1.5">
      <dt className="text-rotulo-coluna text-tinta-suave font-mono uppercase">
        {rotulo}
      </dt>
      <dd className="text-titulo-linha text-tinta">{valor}</dd>
    </dl>
  );
}

/** Os contatos de quem tem conta, em leitura (decisão 2.4 do item 9b). */
function ContatosEmLeitura({ contatos }: { contatos: readonly ContatoDaApi[] }) {
  if (contatos.length === 0) {
    return (
      <p className="text-interface text-tinta-suave px-[15px] py-3.5 md:px-[18px]">
        {TEXTOS_DO_FORMULARIO.semContatos}
      </p>
    );
  }

  return (
    <dl>
      {contatos.map((contato, indice) => {
        const leitura = contatoEmLeitura(contato);
        return (
          <div
            key={contato.id}
            className="border-linha-suave grid grid-cols-[28px_1fr] items-center gap-x-3 gap-y-0.5 border-b px-[15px] py-3 last:border-b-0 md:grid-cols-[28px_1fr_160px_160px] md:px-[18px]"
          >
            <dt className="text-interface text-tinta-suave font-mono tabular-nums">{indice + 1}</dt>
            <dd className="text-interface text-tinta">{leitura.valor}</dd>
            <dd className="text-meta text-tinta-suave col-start-2 md:col-start-auto">{leitura.finalidade}</dd>
            <dd className="text-meta text-tinta-suave col-start-2 md:col-start-auto">
              {leitura.whatsapp ?? ""}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
