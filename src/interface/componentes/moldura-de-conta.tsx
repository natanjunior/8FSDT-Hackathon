import Link from "next/link";
import type { ReactNode } from "react";

import { acaoDeSair } from "@/interface/acoes";
import { Cartao } from "@/interface/componentes/cartao";
import { ControleDeAparencia } from "@/interface/componentes/controle-de-aparencia";
import { MarcaDoProduto } from "@/interface/componentes/marca";
import { Button } from "@/interface/componentes/ui/button";
import { cn } from "@/interface/componentes/utilitarios";

const ID_DO_TITULO = "titulo-da-tela";

/**
 * A página: centrada nas duas direções. `relative` ancora o canto do controle de aparência e o pé.
 *
 * **O fundo reserva o pé** (critério 116.4): o pé é absoluto, e numa tela mais alta que o celular ele
 * cairia em cima do último caminho. A reserva é o respiro do pé, os 44 px do alvo e 16 px de folga.
 */
const PAGINA =
  "relative flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-6 pt-12 pb-[calc(max(1rem,env(safe-area-inset-bottom))+3.75rem)] lg:flex-row lg:gap-16";

/**
 * **Com apresentação, a página é uma grade de uma marca só** (critério 116.13). No celular, uma coluna:
 * a marca, depois a coluna do cartão. A partir de `lg`, duas colunas de 420 px: à esquerda a marca e a
 * frase, centradas na altura pelas duas linhas de `1fr`; à direita o cartão, ocupando as quatro linhas.
 * É o mesmo desenho de antes, com a marca num lugar do documento em vez de dois. **Na tela grande a marca
 * estica até os 420 px da coluna**, como esticava dentro da apresentação: o SVG se desenha centrado na
 * caixa, e é esse o pixel que a comparação do critério 116.14 confere.
 */
const GRADE_DA_APRESENTACAO =
  "grid w-full max-w-[420px] grid-cols-1 gap-5 lg:max-w-none lg:w-auto lg:grid-cols-[420px_420px] lg:grid-rows-[1fr_auto_auto_1fr] lg:gap-x-16 lg:gap-y-6";

/** A coluna do cartão: 420 px a partir de `lg`, a largura toda abaixo disso (critério 44m.8). */
const COLUNA = "flex w-full max-w-[420px] flex-col gap-5";

/** Com convite (item 65): a coluna de 420 px no celular, a fileira de 960 px a partir de `lg`. */
const COLUNA_COM_CONVITE = "flex w-full max-w-[420px] flex-col items-center gap-8 lg:max-w-[960px]";

/**
 * **O canto do controle de aparência** (item 114): no alto à direita da página, espelho do pé de T-01,
 * que fica embaixo. Em 390 px o alvo de 44 px cabe no respiro de 48 px de `PAGINA` sem encostar na
 * marca; na T-01 de tela grande, a apresentação fica à esquerda e o canto direito está livre.
 */
const CANTO = "absolute top-1 right-1";

/**
 * A fileira das duas portas. **Empilhada abaixo de `lg`**, na ordem do documento: cartão, "ou", convite
 * (critério 65.1). A partir de `lg`, três trilhas do design, com o cartão na mais larga.
 */
const FILEIRA =
  "flex w-full flex-col gap-8 lg:grid lg:items-start lg:justify-center lg:gap-x-8 lg:gap-y-0";
const TRILHAS = {
  direita: "lg:grid-cols-[minmax(0,460px)_auto_minmax(0,380px)]",
  esquerda: "lg:grid-cols-[minmax(0,380px)_auto_minmax(0,460px)]",
} as const;

/**
 * **Em que trilha cada metade cai a partir de `lg`.** No documento o cartão vem sempre primeiro; o lado do
 * convite só muda a ordem visual. A moldura e a espera leem daqui, para os dois desenharem a mesma fileira.
 */
const ORDEM_DO_CARTAO = { direita: "lg:order-1", esquerda: "lg:order-3" } as const;
const ORDEM_DO_CONVITE = { direita: "lg:order-3", esquerda: "lg:order-1" } as const;

/**
 * ============================================================================
 *  A moldura das telas fora da casca — itens 44m e 44o
 * ============================================================================
 *
 * **Onze telas, e nenhuma tem barra lateral.** As quatro de credencial — T-01, T-11, T-12 e T-13 —
 * nasceram nela no item 44m; as cinco faces de T-02, a tela de criar organização e T-10 entraram no 44o,
 * quando a moldura antiga de celular foi apagada. **O nome ficou**, porque o critério 44o.1 chama a peça
 * de *"moldura das telas de conta"*; o que ela é, de fato, é a moldura de toda tela fora da casca.
 *
 * **De cima para baixo:** a marca fora do cartão; o cartão com o título da tela e a linha de fato; o
 * conteúdo, quando há; e os caminhos secundários fora do cartão, centrados.
 *
 * **O pé é de toda tela da moldura** (item 116), na moldura e na espera. Ele é absoluto, no respiro de
 * baixo da página, que é reservado para ele.
 *
 * **Componente, e não grupo de rotas.** Desde o item 116, **as quatro telas de credencial** têm uma
 * segunda coluna à esquerda do cartão (critérios 44m.8 e 116.1), e as outras sete telas da moldura não a
 * têm. Um layout de servidor recebe a página por um `children` só, sem saber qual rota está renderizando. O G1 do guia continua valendo: a geometria da página é declarada aqui, em `PAGINA` e
 * `COLUNA`, e nenhum arquivo em `app/` a repete — nem a espera, que usa as mesmas duas constantes.
 *
 * **O salto vertical fica** (critério 116.3). A página centra nas duas direções, e as quatro telas de
 * credencial têm cartões de alturas diferentes: entre `/entrar` e `/criar-conta` o cartão sobe ou desce
 * cerca de 120 px. Alinhar pelo topo foi a variante recusada em 02/10/2026. O horizontal some, porque as
 * quatro têm as mesmas duas colunas.
 *
 * **Desde o item 65 há uma segunda forma de duas colunas**: `/organizacao` (face A) e `/organizacao/criar`
 * recebem a outra porta ao lado do cartão, pela prop `convite`. As duas formas não se combinam — nenhuma
 * tela passa `apresentacao` e `convite` juntos.
 *
 * **Sem régua entre a cabeça e o conteúdo.** O guia §4 reserva a régua para separar naturezas
 * diferentes, e aqui título, linha de fato e formulário são a mesma coisa: a tela. É por isso que a cabeça
 * é escrita aqui e não é a `CabecaDoCartao`, que fixa `<h2>`, o papel de bloco e a régua.
 *
 * **`contexto` aceita nó desde o 44o**, pela razão que fez a `CabecaDoCartao.apoio` aceitar no 44j: três
 * das linhas de fato de T-02 e de T-10 carregam o nome de uma organização em negrito, e o nome é o que a
 * pessoa procura na tela. Continua opcional — a face de link vencido de T-13 não o passa.
 *
 * **`children` é opcional desde o 44o**, e é T-10 quem o omite: quem participa de uma organização só vê o
 * cartão sem a lista (critério 44o.9). Sem conteúdo, o corpo do cartão não é desenhado, e a cabeça ganha
 * o respiro de baixo que o corpo daria.
 *
 * **O controle de aparência fica no canto de cima** (item 114): é o único lugar de fora da casca onde se
 * liga o alto contraste antes de entrar. Vem primeiro na ordem do documento, para quem precisa dele o
 * alcançar no primeiro Tab, antes do formulário. `controle-de-aparencia.tsx` diz o resto.
 *
 * **Componente de servidor. Uma marca só por tela** (item 116, critério 13). Com a apresentação, a grade a
 * põe acima do cartão no celular e no alto da coluna da esquerda na tela grande.
 */
type CabecaDaMoldura =
  | { titulo: string; contexto?: ReactNode; children?: ReactNode; cartao?: undefined }
  /**
   * **O cartão pronto** (item 116, critério 8): para a tela cuja cabeça depende de um desfecho que só o
   * cliente conhece. Hoje é só `/redefinir-senha`, que troca título e contexto quando o link sai.
   */
  | { cartao: ReactNode; titulo?: undefined; contexto?: undefined; children?: undefined };

// `false` é o que um `{condição && <X />}` devolve quando a condição falha — é o caso de T-10.
function haCorpo(children: ReactNode): boolean {
  return children !== undefined && children !== null && typeof children !== "boolean";
}

export function MolduraDeConta(
  props: CabecaDaMoldura & {
    /**
     * As quatro telas de credencial — T-01, T-11, T-12 e T-13 — ligam a segunda coluna a partir de `lg`
     * (critérios 44m.8 e 116.1). Não se combina com `convite`.
     */
    apresentacao?: boolean;
    /**
     * Só `/organizacao` (face A) e `/organizacao/criar` (item 65): a outra porta, ao lado do cartão a partir
     * de `lg`. `lado` é onde ela fica na tela grande; no documento o cartão vem sempre primeiro.
     */
    convite?: { lado: "direita" | "esquerda"; conteudo: ReactNode };
    caminhos?: ReactNode;
  },
) {
  const { apresentacao = false, convite, caminhos } = props;
  // `titulo` é o que separa as duas formas: o cartão pronto não o tem.
  const cartao =
    props.titulo === undefined ? (
      props.cartao
    ) : (
      <CartaoDaTela titulo={props.titulo} contexto={props.contexto} temCorpo={haCorpo(props.children)}>
        {props.children}
      </CartaoDaTela>
    );

  return (
    <main className={PAGINA}>
      <div className={CANTO}>
        <ControleDeAparencia />
      </div>
      {convite === undefined ? (
        apresentacao ? (
          <div className={GRADE_DA_APRESENTACAO}>
            <MarcaDoProduto className="justify-self-center lg:col-start-1 lg:row-start-2 lg:justify-self-stretch" />
            <Apresentacao />
            <div className={cn(COLUNA, "lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:self-center")}>
              {cartao}
              {caminhos !== undefined && <div className="flex flex-col items-center gap-3">{caminhos}</div>}
            </div>
          </div>
        ) : (
          <div className={COLUNA}>
            <MarcaDoProduto className="self-center" />
            {cartao}
            {caminhos !== undefined && <div className="flex flex-col items-center gap-3">{caminhos}</div>}
          </div>
        )
      ) : (
        <div className={COLUNA_COM_CONVITE}>
          <MarcaDoProduto className="self-center" />
          <div className={cn(FILEIRA, TRILHAS[convite.lado])}>
            <div className={cn("flex w-full flex-col", ORDEM_DO_CARTAO[convite.lado])}>
              {cartao}
            </div>
            <ReguaDoOu />
            <div className={cn("flex w-full flex-col", ORDEM_DO_CONVITE[convite.lado])}>
              {convite.conteudo}
            </div>
          </div>
          {caminhos !== undefined && <div className="flex flex-col items-center gap-3">{caminhos}</div>}
        </div>
      )}

      <RodapeDaMoldura />
    </main>
  );
}

/**
 * **O cartão da tela**, o mesmo nas duas formas da moldura — com convite e sem. Extraído no item 65 sem
 * mudar uma classe: o `h1` continua sendo o primeiro título do documento, porque o cartão vem antes do
 * convite na ordem de leitura, em qualquer largura.
 */
export function CartaoDaTela({
  titulo,
  contexto,
  temCorpo,
  children,
}: {
  titulo: string;
  contexto?: ReactNode;
  temCorpo: boolean;
  children?: ReactNode;
}) {
  return (
    <Cartao tituloId={ID_DO_TITULO}>
      <div
        className={cn(
          "flex flex-col gap-1.5 px-[15px] pt-[15px] md:px-[18px] md:pt-[18px]",
          !temCorpo && "pb-[15px] md:pb-[18px]",
        )}
      >
        <h1 id={ID_DO_TITULO} className="text-titulo-pagina text-tinta">
          {titulo}
        </h1>
        {contexto !== undefined && <p className="text-corpo text-tinta-suave">{contexto}</p>}
      </div>

      {temCorpo && (
        <div className="flex flex-col gap-5 px-[15px] py-[15px] md:px-[18px] md:py-[18px]">
          {children}
        </div>
      )}
    </Cartao>
  );
}

/**
 * **A régua do "ou"** (item 65): horizontal no celular, entre o cartão e o convite; vertical a partir de
 * `lg`, do topo ao pé da fileira. É desenho, e por isso `aria-hidden`: a ordem de leitura já diz que são
 * duas saídas.
 *
 * **`deitada`** (item 111) é a mesma régua dentro de um cartão, entre dois botões: horizontal em qualquer
 * largura. Uma régua só, para que o "ou" do QR e o do convite não pareçam outra coisa.
 */
export function ReguaDoOu({ deitada = false }: { deitada?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "text-meta text-tinta-suave flex items-center gap-3",
        !deitada && "lg:order-2 lg:flex-col lg:self-stretch",
      )}
    >
      <span className={cn("bg-linha h-px flex-1", !deitada && "lg:h-auto lg:w-px")} />
      <span>ou</span>
      <span className={cn("bg-linha h-px flex-1", !deitada && "lg:h-auto lg:w-px")} />
    </div>
  );
}

/**
 * **A classe dos caminhos secundários**, os que ficam abaixo do cartão — link ou botão — e que têm todos
 * o mesmo desenho. **A forma é uma só**, para que o "Sair" de T-02 e o "Voltar" da face E não pareçam peças
 * diferentes, e para que nenhuma tela de credencial volte a escrevê-la à mão. **A tinta não**: o *Sair* é
 * a saída, e desce para a tinta suave (item 105), para o laranja ficar na decisão que a tela recebe.
 *
 * **`min-h-11` e `min-w-11` são o piso do guia §9** (44 px), e o piso vale nos dois lados: a sonda do
 * item 91 mediu o "Voltar" da face E em 37 px de largura, com a altura já certa. O `justify-center`
 * mantém a palavra no meio do alvo quando ela é mais curta que ele.
 */
export const CLASSE_DO_CAMINHO =
  "text-tinta-marca text-interface inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-4";

/** Os dois links do pé: sublinhados em repouso, porque no toque não há `hover` (critério 116.4). */
const CLASSE_DO_LINK_DO_PE =
  "text-meta text-tinta-marca inline-flex min-h-11 items-center underline underline-offset-4";

/**
 * **O pé de toda tela da moldura** (critério 116.2): a página do grupo e a documentação, as duas públicas
 * e em nova aba. Até o item 116 só `/entrar` o tinha, escrito à mão, e a porta da documentação não tem
 * motivo para existir só ali. *"Grupo 1"* é nome próprio no crédito (item 106).
 *
 * **Absoluto, e acima da barra do navegador**: com a apresentação a página é uma linha, e um terceiro
 * filho seria uma terceira coluna. O respiro de baixo é o maior entre 16 px e a área segura do aparelho.
 */
function RodapeDaMoldura() {
  return (
    <footer className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center">
      <p className="text-meta text-tinta-suave flex items-center gap-2">
        <Link href="/grupo" target="_blank" rel="noreferrer" className={CLASSE_DO_LINK_DO_PE}>
          Feito pelo Grupo 1<span className="sr-only">, abre em nova aba</span>
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/documentacao" target="_blank" rel="noreferrer" className={CLASSE_DO_LINK_DO_PE}>
          Documentação<span className="sr-only">, abre em nova aba</span>
        </Link>
      </p>
    </footer>
  );
}

/**
 * **O "Sair" das telas fora da casca** — as quatro primeiras faces de T-02, T-10 e, desde o item 65, a
 * tela de criar organização.
 *
 * **Botão dentro de formulário**, como o critério 44b.4 manteve no menu de pessoa: é ação que muda estado
 * no servidor, e não vira link. **É o `Button` do catálogo** (critério 44o.15): até o 44o eram dois
 * botões crus, um em cada página, e o critério 44p.5 os contava entre o que o 44o limparia.
 *
 * **Tinta suave, e não a da marca** (item 105): numa tela que existe para escolher onde trabalhar, a
 * saída não pode ser a única coisa colorida.
 */
export function CaminhoDeSair() {
  return (
    <form action={acaoDeSair}>
      <Button
        type="submit"
        variant="link"
        className={cn(CLASSE_DO_CAMINHO, "text-tinta-suave h-auto min-w-11 px-2 py-0 font-normal")}
      >
        Sair
      </Button>
    </form>
  );
}

/**
 * **A espera das telas fora da casca.** Cada `loading.tsx` de conta, o de T-02, o da tela de criar
 * organização e o da raiz a usam.
 *
 * **A mesma página, as mesmas colunas e a mesma fileira da moldura**, pelas constantes do topo. A marca, a
 * apresentação, o controle de aparência e o pé são de verdade — guia §8: *"a casca e o cabeçalho não são
 * esqueleto"* —, o controle e o pé para não saltarem quando a tela chega. O cartão e o convite são esqueleto, com o desenho e **sem a semântica**: uma região nomeada por um título que ainda
 * não existe seria pior que nenhuma. É o que `app/(casca)/configuracao/loading.tsx` já faz.
 *
 * **As duas formas de duas colunas existem aqui pela mesma razão que existem na moldura** (item 103,
 * critério 5): uma espera de coluna única sob uma tela de duas colunas faz o layout saltar no instante em
 * que o servidor responde, depois da espera mais longa do produto. `apresentacao` é a das quatro telas de
 * credencial; `convite`
 * leva só o lado, porque o conteúdo do convite é da tela e o esqueleto dele é daqui.
 *
 * **O filho é a frase de espera**, que é da tela e não da moldura.
 */
export function EsperaDaMolduraDeConta({
  apresentacao = false,
  convite,
  children,
}: {
  apresentacao?: boolean;
  convite?: { lado: "direita" | "esquerda" };
  children?: ReactNode;
}) {
  return (
    <main className={PAGINA}>
      <div className={CANTO}>
        <ControleDeAparencia />
      </div>
      {convite === undefined ? (
        apresentacao ? (
          <div className={GRADE_DA_APRESENTACAO}>
            <MarcaDoProduto className="justify-self-center lg:col-start-1 lg:row-start-2 lg:justify-self-stretch" />
            <Apresentacao />
            <div className={cn(COLUNA, "lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:self-center")}>
              <CartaoDeEspera />
              {children}
            </div>
          </div>
        ) : (
          <div className={COLUNA}>
            <MarcaDoProduto className="self-center" />
            <CartaoDeEspera />
            {children}
          </div>
        )
      ) : (
        <div className={COLUNA_COM_CONVITE}>
          <MarcaDoProduto className="self-center" />
          <div className={cn(FILEIRA, TRILHAS[convite.lado])}>
            <div className={cn("flex w-full flex-col", ORDEM_DO_CARTAO[convite.lado])}>
              <CartaoDeEspera />
            </div>
            <ReguaDoOu />
            <div className={cn("flex w-full flex-col", ORDEM_DO_CONVITE[convite.lado])}>
              <ConviteDeEspera />
            </div>
          </div>
          {children}
        </div>
      )}

      <RodapeDaMoldura />
    </main>
  );
}

/** O cartão da tela, em esqueleto: título, linha de fato, um campo e um botão. */
function CartaoDeEspera() {
  return (
    <div
      aria-hidden="true"
      className="border-linha bg-superficie flex flex-col gap-4 rounded-lg border p-[15px] shadow-sm md:p-[18px]"
    >
      <div className="bg-secondary h-7 w-[70%] animate-pulse rounded" />
      <div className="bg-secondary h-4 w-[90%] animate-pulse rounded" />
      <div className="bg-secondary h-11 animate-pulse rounded" />
      <div className="bg-secondary h-11 w-[45%] self-end animate-pulse rounded" />
    </div>
  );
}

/**
 * A outra porta, em esqueleto, na forma de `ConviteDaOutraPorta`: título, frase, três itens e o botão de
 * largura inteira. Sem cartão em volta, porque o convite não tem.
 */
function ConviteDeEspera() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="bg-secondary h-6 w-[80%] animate-pulse rounded" />
      <div className="bg-secondary h-4 w-[95%] animate-pulse rounded" />
      <div className="flex flex-col gap-2.5">
        <div className="bg-secondary h-4 w-[60%] animate-pulse rounded" />
        <div className="bg-secondary h-4 w-[70%] animate-pulse rounded" />
        <div className="bg-secondary h-4 w-[65%] animate-pulse rounded" />
      </div>
      <div className="bg-secondary h-11 animate-pulse rounded" />
    </div>
  );
}

/**
 * A coluna da esquerda das quatro telas de credencial, na tela grande (critérios 44m.8 e 116.1): a frase
 * da direção, e a pauta ao fundo. **A marca não é desenhada aqui desde o item 116**: a grade a posiciona,
 * e o documento tem uma só.
 *
 * **A pauta é desenho, não imagem.** O período é de **22 px**, que é a entrelinha do papel de corpo — é o
 * que amarra o fundo à escala em vez de a um número escolhido à mão. Ela é decoração: `aria-hidden`, sem
 * movimento, e fica sobre o `--ground` da página, nunca sobre uma faixa, porque no tema escuro o
 * `--line-soft` tem o mesmo valor do `--sunken` (guia §4) e a régua sumiria.
 */
function Apresentacao() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none relative hidden lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:block"
      >
        <div
          className="absolute -inset-x-6 -inset-y-8 -z-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0, transparent 21px, var(--line-soft) 21px, var(--line-soft) 22px)",
          }}
        />
      </div>
      <p className="text-titulo-bloco text-tinta hidden lg:col-start-1 lg:row-start-3 lg:block">
        O livro de ocorrências da sua organização, aberto para quem cuida.
      </p>
    </>
  );
}
