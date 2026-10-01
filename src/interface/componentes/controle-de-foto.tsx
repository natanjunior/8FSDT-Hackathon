"use client";

import { CircleAlertIcon, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import {
  FOTO,
  FRASES_DA_FOTO,
  FRASES_DO_SERVIDOR,
  ROTULOS,
} from "@/interface/componentes/registro-de-ocorrencia";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { TooltipProvider } from "@/interface/componentes/ui/tooltip";

import {
  ImagemGrandeDemais,
  ImagemIlegivel,
  LIMITE_DO_SELETOR_EM_BYTES,
  comprimir,
} from "./compressao-de-imagem";

/**
 * ============================================================================
 *  O controle de foto de T-04 — o primeiro alvo da tela
 * ============================================================================
 *
 * **Ele fica acima do título, e é o DG-5 inteiro.** O protótipo (§2.3 e o desenho D-1) moveu a foto para
 * cima justamente para **garantir o paralelismo**: com a foto por último, os 400 KB entram na conta do
 * RNF6 — cerca de 3,5 s em 4G real, e até 12 s em rede ruim. Com ela primeiro, o upload corre enquanto a
 * pessoa digita, e não entra na soma.
 *
 * **A tela não espera o upload para habilitar o envio** (critério 13a.4) — ela espera só `chave` e
 * `ticket`, que chegam do `201` da autorização. Habilitar e submeter são coisas diferentes: **o envio**
 * espera o `PUT` terminar, porque reivindicar um objeto que ainda não chegou produziria um `422`
 * evitável. Isso passa a valer no item 13b, que é quem reivindica.
 *
 * **A referência sobe para o formulário, e é o item 13b.** O controle anuncia o estado inteiro por
 * `aoMudar` — inclusive a **promessa** do `PUT` em voo —, e é o formulário que a manda em `anexos[]`. Ela
 * não é guardada aqui: guardá-la nos dois lugares seria a segunda cópia que diverge.
 *
 * **Acessibilidade:** rótulo associado ao controle (A-1); alvo de 44 px (A-3); e **todo estado carrega a
 * palavra**, nunca só a barra ou a cor (A-5).
 */

/**
 * **A barra existe, e é indeterminada.** O protótipo (§7.1) lista um `Progress` para o envio; ele não
 * entra, e por duas razões independentes: `fetch` **não emite evento de progresso de envio** — quem emite
 * é `XMLHttpRequest`, e trocar o transporte é escopo que ninguém pediu na tela cronometrada —, e
 * `progress` não está na lista do guia §7, então pôr um primitivo novo para desenhar duas divisões seria
 * pacote por enfeite. O que entra é uma faixa que diz *"está acontecendo"*, não *"falta tanto"*: peça
 * local, `aria-hidden`, parada sob movimento reduzido. **O que o compromisso A-5 exige é a palavra, e ela
 * está lá** — *"Enviando a foto"* mais *"Você pode continuar escrevendo."*
 */
type Situacao =
  | { nome: "vazio" }
  | { nome: "comprimindo" }
  | { nome: "enviando"; previa: string }
  | { nome: "pronta"; previa: string }
  | { nome: "erro"; mensagem: string };

const ACEITOS = "image/*";

/** O que o formulário manda em `anexos[]`. **Só isto sai do controle** — a miniatura vem do ticket. */
export type ReferenciaDoAnexo = { chave: string; ticket: string };

/**
 * O estado do anexo, **como o formulário precisa vê-lo**.
 *
 * **A promessa em `subindo` é o ponto, e ela existe por uma frase do 13a:** *"o botão não espera para
 * habilitar — é o critério 13a.4 — mas o envio espera o `PUT` terminar. Vale a partir do 13b"*. Habilitar
 * e submeter são coisas diferentes: o botão fica clicável o tempo todo, e ao ser clicado com o upload em
 * voo o formulário **aguarda `conclusao`**, com o botão em *"Registrando…"*.
 *
 * Sem a promessa, a única forma de esperar seria pesquisar estado em laço — e a única forma de não
 * esperar seria mandar reivindicar um objeto que ainda não chegou, produzindo um `422` evitável.
 *
 * **`conclusao` NUNCA rejeita:** resolve com a referência, ou com `null` quando o `PUT` falhou. Registro
 * enviado sem foto é desfecho legítimo — o anexo é opcional em todo o contrato.
 */
export type EstadoDoAnexo =
  | { nome: "vazio" }
  | { nome: "subindo"; conclusao: Promise<ReferenciaDoAnexo | null> }
  | { nome: "pronta"; referencia: ReferenciaDoAnexo }
  | { nome: "falhou" };

export function ControleDeFoto({
  aoMudar,
  erro,
  organizacaoId,
}: {
  /** O formulário é quem guarda o estado do anexo — o controle apenas o anuncia. */
  aoMudar: (estado: EstadoDoAnexo) => void;
  /** O erro que veio do `POST /ocorrencias` sobre a foto. Vai **abaixo do campo** (achado P-02). */
  erro?: string;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
}) {
  const [situacao, setSituacao] = useState<Situacao>({ nome: "vazio" });
  const entrada = useRef<HTMLInputElement>(null);

  /**
   * Uma repetição silenciosa antes de desistir. Rede de garagem cai uma vez e volta; transformar a
   * primeira queda em mensagem seria pedir à pessoa que fizesse o que o cliente pode fazer sozinho.
   */
  async function enviar(
    destino: { url: string; cabecalhos: Record<string, string> },
    bytes: Blob,
  ): Promise<boolean> {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const resposta = await fetch(destino.url, {
        method: "PUT",
        headers: destino.cabecalhos,
        body: bytes,
      }).catch(() => null);

      if (resposta !== null && resposta.ok) return true;
    }
    return false;
  }

  async function escolher(arquivo: File) {
    // O teto do seletor é do RNF8, e a recusa acontece **antes de decodificar**: um arquivo de 40 MB não
    // precisa virar bitmap para se saber que não serve.
    if (arquivo.size > LIMITE_DO_SELETOR_EM_BYTES) {
      setSituacao({ nome: "erro", mensagem: FRASES_DO_SERVIDOR.ANEXO_ACIMA_DO_LIMITE! });
      aoMudar({ nome: "falhou" });
      return;
    }

    // Trocar a foto sem passar por "Remover" descartaria a `blob:` anterior sem revogá-la, e o navegador
    // segura os bytes até a aba fechar. Uma linha, e a quarta foto não custa quatro fotos de memória.
    if ("previa" in situacao) URL.revokeObjectURL(situacao.previa);

    setSituacao({ nome: "comprimindo" });

    let comprimida;
    try {
      comprimida = await comprimir(arquivo);
    } catch (erro) {
      setSituacao({
        nome: "erro",
        mensagem:
          erro instanceof ImagemIlegivel
            ? FOTO.ilegivel
            : erro instanceof ImagemGrandeDemais
              ? FRASES_DO_SERVIDOR.ANEXO_ACIMA_DO_LIMITE!
              : FOTO.naoPreparou,
      });
      aoMudar({ nome: "falhou" });
      return;
    }

    // A prévia aparece **antes** de qualquer byte subir: é o retorno mais rápido que a tela consegue dar.
    const previa = URL.createObjectURL(comprimida.arquivo);
    setSituacao({ nome: "enviando", previa });

    const resposta = await fetch("/api/anexos/autorizacoes", {
      method: "POST",
      headers: cabecalhosDeEscrita(organizacaoId),
      body: JSON.stringify({ tipoConteudo: "image/jpeg", tamanhoBytes: comprimida.arquivo.size }),
    });

    if (!resposta.ok) {
      /**
       * **O mesmo mecanismo do resto do produto** (`mensagemDoProblema`), e o controle de foto era o
       * último lugar que ainda escolhia a frase à mão. A ordem é: a frase da tela para aquele `codigo`; o
       * `detail` do servidor quando há um; e a genérica no resto.
       *
       * **O que sai daqui é o último degrau do encadeamento antigo**, que chamava de *"grande demais"*
       * tudo o que não reconhecia — inclusive o `500`, que por contrato vem sem `detail`. É o V-12.
       *
       * **O `409 ORGANIZACAO_DIVERGENTE` continua mostrando o texto do servidor**, que é a decisão do
       * item 7b: ele cai no degrau do `detail`.
       */
      setSituacao({
        nome: "erro",
        mensagem: mensagemDoProblema(await resposta.json().catch(() => null), FRASES_DA_FOTO),
      });
      aoMudar({ nome: "falhou" });
      return;
    }

    const autorizacao: {
      chave: string;
      ticket: string;
      upload: { url: string; cabecalhos: Record<string, string> };
      uploadMiniatura: { url: string; cabecalhos: Record<string, string> };
    } = await resposta.json();

    const referencia: ReferenciaDoAnexo = {
      chave: autorizacao.chave,
      ticket: autorizacao.ticket,
    };

    // Os dois `PUT` em paralelo, direto no storage, **fora da API**. A miniatura é opcional: se ela não
    // subir, a ocorrência é criada igual e a listagem só perde a prévia.
    const principal = enviar(autorizacao.upload, comprimida.arquivo).catch(() => false);
    const miniatura =
      comprimida.miniatura === null
        ? Promise.resolve(true)
        : enviar(autorizacao.uploadMiniatura, comprimida.miniatura).catch(() => false);

    /**
     * **A promessa que o formulário aguarda.** Ela é criada aqui, no instante em que os `PUT` começam, e
     * é entregue ao formulário **antes** de terminarem — que é a razão de ela existir. Nunca rejeita.
     */
    const conclusao: Promise<ReferenciaDoAnexo | null> = (async () => {
      const subiu = await principal;
      // A miniatura é aguardada, mas não decide nada: prévia é conveniência, anexo é evidência.
      await miniatura;
      return subiu ? referencia : null;
    })();

    aoMudar({ nome: "subindo", conclusao });

    const pronta = await conclusao;

    setSituacao(
      pronta !== null
        ? { nome: "pronta", previa }
        : { nome: "erro", mensagem: FOTO.naoSubiu },
    );
    aoMudar(pronta !== null ? { nome: "pronta", referencia } : { nome: "falhou" });
  }

  function limpar() {
    if ("previa" in situacao) URL.revokeObjectURL(situacao.previa);
    setSituacao({ nome: "vazio" });
    aoMudar({ nome: "vazio" });
    // Trocar a foto **abandona** o objeto que já subiu — a faxina o recolhe, e a foto nova consome um slot
    // novo das 30/h. Não há chamada de cancelamento no contrato, e não vai haver.
    if (entrada.current !== null) entrada.current.value = "";
  }

  const subindo = situacao.nome === "comprimindo" || situacao.nome === "enviando";
  const previa = "previa" in situacao ? situacao.previa : null;

  const palavra =
    situacao.nome === "comprimindo"
      ? { titulo: FOTO.preparando, apoio: FOTO.subindoApoio }
      : situacao.nome === "enviando"
        ? { titulo: FOTO.subindoTitulo, apoio: FOTO.subindoApoio }
        : situacao.nome === "pronta"
          ? { titulo: FOTO.prontaTitulo, apoio: FOTO.prontaApoio }
          : situacao.nome === "erro"
            ? { titulo: situacao.mensagem, apoio: "" }
            : null;

  return (
    <div className="flex flex-col gap-2">
      {/* O rótulo continua ligado ao controle por `htmlFor` (compromisso A-1), e fica oculto: o alvo
          grande já diz "Adicionar foto" em palavra, e dois rótulos seriam a mesma frase duas vezes. */}
      <label htmlFor="foto" className="sr-only">
        {ROTULOS.foto}
      </label>

      {/* **A entrada de arquivo continua crua**, porque o catálogo não tem peça para ela — e o critério
          G7 do guia não conta entrada. Ela fica fora da tabulação (critério 94.5): quem abre o seletor é o
          botão visível, e uma parada invisível era um Tab sem destino. */}
      <input
        ref={entrada}
        id="foto"
        type="file"
        accept={ACEITOS}
        className="sr-only"
        tabIndex={-1}
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo !== undefined) void escolher(arquivo);
        }}
      />

      {previa === null && situacao.nome !== "erro" ? (
        /* **O alvo grande, e ele é o `Button` do catálogo** (critério 6). A altura é própria: é o
           primeiro alvo da tela, e a prancheta o desenha ocupando a largura inteira.
           A zona de soltar e a ficha do arquivo têm o raio de cartão: são regiões que recebem conteúdo, e
           não controles de linha. Exceção nomeada no guia, §4 (item 104, critério 7). */
        <Button
          type="button"
          variant="outline"
          onClick={() => entrada.current?.click()}
          className="border-linha bg-background h-auto min-h-11 w-full flex-col items-center gap-1.5 rounded-lg border-dashed py-7"
        >
          <span className="border-linha bg-superficie text-tinta-suave mb-0.5 flex size-11 items-center justify-center rounded-sm border">
            <ImagePlus aria-hidden="true" className="size-5" />
          </span>
          <span className="text-interface text-tinta font-medium">{FOTO.vazioTitulo}</span>
          <span className="text-meta text-tinta-suave font-normal">{FOTO.vazioApoio}</span>
        </Button>
      ) : (
        <div className="border-linha bg-superficie flex items-center gap-3 rounded-lg border p-2.5">
          {previa !== null && (
            /*
              **Uma divisão com `background-image`, e não a tag de imagem.** `@next/next/no-img-element`
              dispara sobre a tag, e desativá-lo gastaria o **primeiro `eslint-disable` do repositório** —
              que o DoD lista como um dos quatro instrumentos que substituem o revisor humano.
              `next/image` também não serve: a fonte é uma `blob:` local, sem otimização a fazer e sem
              dimensão conhecida.

              **A acessibilidade não é perdida no caminho:** `role="img"` + `aria-label` dão ao leitor de
              tela exatamente o que o `alt` daria.
            */
            <div
              role="img"
              aria-label="A foto escolhida"
              className="bg-background size-14 shrink-0 rounded-sm bg-cover bg-center"
              style={{ backgroundImage: `url(${previa})` }}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* **A palavra, sempre** — compromisso A-5. Barra sem texto é defeito. */}
            <p role="status" className="text-interface text-tinta font-medium">
              {palavra?.titulo ?? ""}
            </p>
            {subindo ? (
              /* **A barra é indeterminada, e isso é decisão declarada.** Ela é `aria-hidden`: quem
                 carrega o estado para o leitor de tela é a frase acima. **Não anima sob movimento
                 reduzido** (guia §6), e nesse caso fica uma faixa parada. */
              <div aria-hidden="true" className="bg-linha-suave h-1 w-full overflow-hidden rounded-full">
                <div className="bg-marca h-full w-2/5 rounded-full motion-safe:animate-pulse" />
              </div>
            ) : null}
            {palavra !== null && palavra.apoio !== "" && (
              <p className="text-meta text-tinta-suave">{palavra.apoio}</p>
            )}
          </div>
          {/* **Trocar e remover são botões só com ícone** — a regra de *Ações de linha* do guia §7.
              **O `TooltipProvider` é obrigatório aqui, e é a diferença entre T-04 e as telas da casca.**
              O `BotaoDeIcone` monta uma dica do Radix, e o Radix **lança** *"`Tooltip` must be used
              within `TooltipProvider`"* quando não há provedor acima — o contexto dele não tem valor
              padrão. Nas telas do 44j e do 44k o provedor vem de graça, dentro do `SidebarProvider` de
              `app/(casca)/layout.tsx`; T-04 mora na moldura focada, que não tem barra lateral e por isso
              não tem provedor nenhum. Ele fica aqui, e não no layout `(foco)`, porque é este arquivo que
              traz a dependência: o dia em que a foto deixar de usar botão de ícone, o provedor sai com
              ela. */}
          <TooltipProvider>
            <span className="flex shrink-0 items-center gap-1.5">
              <BotaoDeIcone
                rotulo={FOTO.trocar}
                icone={<RefreshCw aria-hidden="true" />}
                onClick={() => entrada.current?.click()}
              />
              <BotaoDeIcone
                rotulo={FOTO.remover}
                icone={<Trash2 aria-hidden="true" />}
                onClick={limpar}
              />
            </span>
          </TooltipProvider>
        </div>
      )}

      {erro !== undefined && (
        /* **A-5: texto, nunca só cor.** E fica logo abaixo do campo, porque com o teclado aberto sobra
           metade da tela e o campo, o rótulo e o erro têm de caber juntos acima dele (achado P-02). */
        <p role="alert" className="text-destructive text-meta flex items-center gap-1.5 font-medium">
          <CircleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{erro}</span>
        </p>
      )}
    </div>
  );
}
