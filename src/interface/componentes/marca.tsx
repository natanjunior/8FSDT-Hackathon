import Image, { getImageProps } from "next/image";

import { cn } from "@/interface/componentes/utilitarios";

/**
 * **A marca do produto, e ela é uma só.**
 *
 * **O logotipo do dono, desde o item 76.** Até ali era o ícone de caderno com o rótulo em mono versal. Os
 * arquivos moram em `public/marca/`, consertados antes de entrar (`viewBox`, sem metadado, e os miolos
 * das letras vazados, para o fundo aparecer no tema escuro).
 *
 * **Imagem, e não SVG no HTML:** o logotipo são 51 KB de caminhos, e embutido ele viria em toda resposta
 * de página. Como imagem, o navegador o guarda uma vez. O `next/image` não otimiza SVG e serve o arquivo
 * como está (`image.md:939` do Next 16).
 *
 * **Dois tamanhos e nenhum terceiro:** 20 px na barra superior (critério 76.7) e 32 px fora da casca, que
 * é a moldura das onze telas de conta e o cabeçalho de `/grupo`. **Na barra estreita, abaixo de `md`,
 * entra o ícone do R** (critério 76.8): com o gatilho da gaveta, o seletor de organização e o menu da
 * pessoa, o logotipo de 83 px apertaria o seletor num celular de 360 px. **Uma imagem só** (item 116):
 * um elemento `picture` em que o navegador escolhe o arquivo pela largura e baixa só ele. O leitor de tela ouve
 * a marca uma vez.
 *
 * **Consumidores:** a barra superior, a moldura das telas fora da casca (uma vez por tela) e a página do grupo.
 * Duas marcas diferentes para o mesmo produto é o defeito que este arquivo existe para impedir.
 *
 * **A marca pinta cedo** (item 106, critério 4). Ela é o primeiro elemento de toda tela, e o padrão do
 * `next/image` é carregamento adiado. A prop de prioridade está descontinuada no Next 16, e `preload` é
 * desaconselhado quando a candidata muda com a largura da tela, que é o caso da barra. Fica
 * o carregamento `eager` na imagem da página e nas duas candidatas da barra. O critério 116.12 pedia
 * a prop de prioridade; o efeito já estava aqui.
 *
 * **Componente de servidor.**
 */
export function MarcaDoProduto({
  tamanho = "pagina",
  className,
}: {
  tamanho?: "barra" | "pagina";
  className?: string;
}) {
  if (tamanho === "barra") {
    // SVG não é otimizado pelo `next/image`, então `getImageProps` devolve `src` e nenhum `srcSet`: a fonte
    // usa o `src`. A imagem dentro de `picture` é a exceção da regra `no-img-element`, e é o padrão de
    // direção de arte da documentação do Next. O `width`/`height` da fonte dá a proporção do logotipo.
    const comum = { alt: "Resolve Aí", loading: "eager" } as const;
    const logotipo = getImageProps({ ...comum, src: "/marca/logo.svg", width: 3732, height: 900 }).props;
    const icone = getImageProps({ ...comum, src: "/marca/icone.svg", width: 1412, height: 1240 }).props;
    return (
      <span className={cn("flex items-center", className)}>
        <picture>
          <source media="(min-width: 768px)" srcSet={logotipo.src} width={3732} height={900} />
          <img {...icone} alt="Resolve Aí" className="h-5 w-auto" />
        </picture>
      </span>
    );
  }

  return (
    <Image
      src="/marca/logo.svg"
      alt="Resolve Aí"
      width={3732}
      height={900}
      loading="eager"
      className={cn("h-8 w-auto", className)}
    />
  );
}
