import type { ReactNode } from "react";

import { acaoDeSair } from "@/interface/acoes";
import { Cartao } from "@/interface/componentes/cartao";
import { MarcaDoProduto } from "@/interface/componentes/marca";
import { Button } from "@/interface/componentes/ui/button";
import { cn } from "@/interface/componentes/utilitarios";

const ID_DO_TITULO = "titulo-da-tela";

/** A página: centrada nas duas direções, e em linha a partir de `lg` quando há apresentação. `relative`
 *  ancora o pé de T-01, que fica fora da linha. */
const PAGINA =
  "relative flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-6 py-12 lg:flex-row lg:gap-16";

/** A coluna do cartão: 420 px a partir de `lg`, a largura toda abaixo disso (critério 44m.8). */
const COLUNA = "flex w-full max-w-[420px] flex-col gap-5";

/** Com convite (item 65): a coluna de 420 px no celular, a fileira de 960 px a partir de `lg`. */
const COLUNA_COM_CONVITE = "flex w-full max-w-[420px] flex-col items-center gap-8 lg:max-w-[960px]";

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
 * **O pé é de T-01 só** (item 70): os links para a página do grupo e para a documentação. Ele é absoluto,
 * no respiro de baixo da página, porque com a apresentação a página é uma linha, e um terceiro filho seria
 * uma terceira coluna.
 *
 * **Componente, e não grupo de rotas.** O critério 44m.8 dá a **T-01 sozinha** uma segunda coluna à
 * esquerda do cartão, e um layout de servidor recebe a página por um `children` só, sem saber qual rota
 * está renderizando. O G1 do guia continua valendo: a geometria da página é declarada aqui, em `PAGINA` e
 * `COLUNA`, e nenhum arquivo em `app/` a repete — nem a espera, que usa as mesmas duas constantes.
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
 * **Componente de servidor.** A marca aparece duas vezes no `apresentacao`, uma escondida em cada
 * largura, porque ela troca de lugar: acima do cartão no celular, na coluna da esquerda na tela grande.
 */
export function MolduraDeConta({
  titulo,
  contexto,
  apresentacao = false,
  convite,
  caminhos,
  rodape,
  children,
}: {
  titulo: string;
  contexto?: ReactNode;
  /** Só T-01: liga a segunda coluna a partir de `lg` (critério 44m.8). */
  apresentacao?: boolean;
  /**
   * Só `/organizacao` (face A) e `/organizacao/criar` (item 65): a outra porta, ao lado do cartão a partir
   * de `lg`. `lado` é onde ela fica na tela grande; no documento o cartão vem sempre primeiro.
   */
  convite?: { lado: "direita" | "esquerda"; conteudo: ReactNode };
  caminhos?: ReactNode;
  /** Só T-01: os links do pé da página, fora da linha das colunas (item 70). */
  rodape?: ReactNode;
  children?: ReactNode;
}) {
  // `false` é o que um `{condição && <X />}` devolve quando a condição falha — é o caso de T-10.
  const temCorpo = children !== undefined && children !== null && typeof children !== "boolean";

  return (
    <main className={PAGINA}>
      {apresentacao && <Apresentacao />}

      {convite === undefined ? (
        <div className={COLUNA}>
          <MarcaDoProduto className={cn("self-center", apresentacao && "lg:hidden")} />
          <CartaoDaTela titulo={titulo} contexto={contexto} temCorpo={temCorpo}>
            {children}
          </CartaoDaTela>
          {caminhos !== undefined && <div className="flex flex-col items-center gap-3">{caminhos}</div>}
        </div>
      ) : (
        <div className={COLUNA_COM_CONVITE}>
          <MarcaDoProduto className="self-center" />
          <div className={cn(FILEIRA, TRILHAS[convite.lado])}>
            <div
              className={cn(
                "flex w-full flex-col",
                convite.lado === "esquerda" ? "lg:order-3" : "lg:order-1",
              )}
            >
              <CartaoDaTela titulo={titulo} contexto={contexto} temCorpo={temCorpo}>
                {children}
              </CartaoDaTela>
            </div>
            <ReguaDoOu />
            <div
              className={cn(
                "flex w-full flex-col",
                convite.lado === "esquerda" ? "lg:order-1" : "lg:order-3",
              )}
            >
              {convite.conteudo}
            </div>
          </div>
          {caminhos !== undefined && <div className="flex flex-col items-center gap-3">{caminhos}</div>}
        </div>
      )}

      {rodape !== undefined && (
        <footer className="absolute inset-x-0 bottom-0 flex justify-center">{rodape}</footer>
      )}
    </main>
  );
}

/**
 * **O cartão da tela**, o mesmo nas duas formas da moldura — com convite e sem. Extraído no item 65 sem
 * mudar uma classe: o `h1` continua sendo o primeiro título do documento, porque o cartão vem antes do
 * convite na ordem de leitura, em qualquer largura.
 */
function CartaoDaTela({
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
 */
function ReguaDoOu() {
  return (
    <div
      aria-hidden="true"
      className="text-meta text-tinta-suave flex items-center gap-3 lg:order-2 lg:flex-col lg:self-stretch"
    >
      <span className="bg-linha h-px flex-1 lg:h-auto lg:w-px" />
      <span>ou</span>
      <span className="bg-linha h-px flex-1 lg:h-auto lg:w-px" />
    </div>
  );
}

/**
 * **A classe dos caminhos secundários**, os que ficam abaixo do cartão — link ou botão. Uma só, para que
 * o "Sair" de T-02 e o "Voltar" da face E não pareçam coisas diferentes, e para que nenhuma tela de
 * credencial volte a escrevê-la à mão.
 *
 * **`min-h-11` e `min-w-11` são o piso do guia §9** (44 px), e o piso vale nos dois lados: a sonda do
 * item 91 mediu o "Voltar" da face E em 37 px de largura, com a altura já certa. O `justify-center`
 * mantém a palavra no meio do alvo quando ela é mais curta que ele.
 */
export const CLASSE_DO_CAMINHO =
  "text-tinta-marca text-interface inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-4";

/**
 * **O "Sair" das telas fora da casca** — as quatro primeiras faces de T-02, T-10 e, desde o item 65, a
 * tela de criar organização.
 *
 * **Botão dentro de formulário**, como o critério 44b.4 manteve no menu de pessoa: é ação que muda estado
 * no servidor, e não vira link. **É o `Button` do catálogo** (critério 44o.15): até o 44o eram dois
 * botões crus, um em cada página, e o critério 44p.5 os contava entre o que o 44o limparia.
 */
export function CaminhoDeSair() {
  return (
    <form action={acaoDeSair}>
      <Button
        type="submit"
        variant="link"
        className={cn(CLASSE_DO_CAMINHO, "h-auto min-w-11 px-2 py-0 font-normal")}
      >
        Sair
      </Button>
    </form>
  );
}

/**
 * **A espera das telas fora da casca.** O `loading.tsx` de T-02 a usa, e ela cobre também a tela de
 * criar organização, que é filha do mesmo segmento.
 *
 * **A mesma página e a mesma coluna da moldura**, pelas duas constantes do topo. A marca é de verdade —
 * guia §8: *"a casca e o cabeçalho não são esqueleto"* —, e o cartão é esqueleto, com o desenho do
 * `Cartao` e **sem a semântica dele**: uma região nomeada por um título que ainda não existe seria pior
 * que nenhuma. É o que `app/(casca)/configuracao/loading.tsx` já faz.
 *
 * **O filho é a frase de espera**, que é da tela e não da moldura.
 */
export function EsperaDaMolduraDeConta({ children }: { children?: ReactNode }) {
  return (
    <main className={PAGINA}>
      <div className={COLUNA}>
        <MarcaDoProduto className="self-center" />
        <div
          aria-hidden="true"
          className="border-linha bg-superficie flex flex-col gap-4 rounded-lg border p-[15px] shadow-sm md:p-[18px]"
        >
          <div className="bg-secondary h-7 w-[70%] animate-pulse rounded" />
          <div className="bg-secondary h-4 w-[90%] animate-pulse rounded" />
          <div className="bg-secondary h-11 animate-pulse rounded" />
          <div className="bg-secondary h-11 w-[45%] self-end animate-pulse rounded" />
        </div>
        {children}
      </div>
    </main>
  );
}

/**
 * A coluna da esquerda de T-01, na tela grande (critério 44m.8): a marca, a frase da direção, e a pauta ao
 * fundo.
 *
 * **A pauta é desenho, não imagem.** O período é de **22 px**, que é a entrelinha do papel de corpo — é o
 * que amarra o fundo à escala em vez de a um número escolhido à mão. Ela é decoração: `aria-hidden`, sem
 * movimento, e fica sobre o `--ground` da página, nunca sobre uma faixa, porque no tema escuro o
 * `--line-soft` tem o mesmo valor do `--sunken` (guia §4) e a régua sumiria.
 */
function Apresentacao() {
  return (
    <div className="relative hidden max-w-[420px] flex-col gap-6 lg:flex">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 21px, var(--line-soft) 21px, var(--line-soft) 22px)",
        }}
      />
      <MarcaDoProduto />
      <p className="text-titulo-bloco text-tinta">O livro de ocorrências da sua organização, aberto para quem cuida.</p>
    </div>
  );
}
