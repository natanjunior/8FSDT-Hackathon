import type { ReactNode } from "react";

import { Cartao } from "@/interface/componentes/cartao";
import { MarcaDoProduto } from "@/interface/componentes/marca";
import { cn } from "@/interface/componentes/utilitarios";

const ID_DO_TITULO = "titulo-da-tela";

/**
 * ============================================================================
 *  A moldura das quatro telas de conta — item 44m
 * ============================================================================
 *
 * T-01, T-11, T-12 e T-13. **De cima para baixo:** a marca fora do cartão; o cartão com o título da tela
 * e a linha de contexto; o conteúdo, que é o formulário ou o bloco que o substitui; e os caminhos
 * secundários fora do cartão, centrados (critério 1).
 *
 * **Componente, e não grupo de rotas.** O critério 8 dá a **T-01 sozinha** uma segunda coluna à esquerda
 * do cartão, e um layout de servidor recebe a página por um `children` só, sem saber qual rota está
 * renderizando — atender o critério por grupo de rotas pediria um segundo grupo aninhado, dois para
 * quatro páginas. O G1 do guia continua valendo: a moldura não é declarada em `app/`.
 *
 * **Sem régua entre a cabeça e o conteúdo.** O guia §4 reserva a régua para separar naturezas
 * diferentes, e aqui título, contexto e formulário são a mesma coisa: a tela. É por isso que a cabeça é
 * escrita aqui e não é a `CabecaDoCartao`, que fixa `<h2>`, o papel de bloco e a régua — nestas telas o
 * título **é** o da página, e não há cabeçalho acima dele.
 *
 * **`contexto` é opcional**, e a face de link vencido de T-13 é quem o omite: ali a linha de contexto
 * prometeria um formulário que a face não tem.
 *
 * **Componente de servidor.** A marca aparece duas vezes no `apresentacao`, uma escondida em cada
 * largura, porque ela troca de lugar: acima do cartão no celular, na coluna da esquerda na tela grande.
 */
export function MolduraDeConta({
  titulo,
  contexto,
  apresentacao = false,
  caminhos,
  children,
}: {
  titulo: string;
  contexto?: string;
  /** Só T-01: liga a segunda coluna a partir de `lg` (critério 8). */
  apresentacao?: boolean;
  caminhos?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-6 py-12 lg:flex-row lg:gap-16">
      {apresentacao && <Apresentacao />}

      <div className="flex w-full max-w-[420px] flex-col gap-5">
        <MarcaDoProduto className={cn("self-center", apresentacao && "lg:hidden")} />

        <Cartao tituloId={ID_DO_TITULO}>
          <div className="flex flex-col gap-1.5 px-[15px] pt-[15px] md:px-[18px] md:pt-[18px]">
            <h1 id={ID_DO_TITULO} className="text-titulo-pagina text-tinta leading-snug font-semibold">
              {titulo}
            </h1>
            {contexto !== undefined && <p className="text-corpo text-tinta-suave">{contexto}</p>}
          </div>

          <div className="flex flex-col gap-5 px-[15px] py-[15px] md:px-[18px] md:py-[18px]">
            {children}
          </div>
        </Cartao>

        {caminhos !== undefined && <div className="flex flex-col items-center gap-3">{caminhos}</div>}
      </div>
    </main>
  );
}

/**
 * A coluna da esquerda de T-01, na tela grande (critério 8): a marca, a frase da direção, e a pauta ao
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
      <p className="text-titulo-bloco text-tinta leading-snug font-semibold">
        O que é registrado aqui fica registrado, com data e autor.
      </p>
    </div>
  );
}
