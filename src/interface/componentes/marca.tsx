import Image from "next/image";

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
 * pessoa, o logotipo de 83 px apertaria o seletor num celular de 360 px. As duas imagens estão no
 * documento e uma sempre com `display: none`, então o leitor de tela ouve a marca uma vez.
 *
 * **Consumidores:** a barra superior, a moldura das telas fora da casca (três vezes) e a página do grupo.
 * Duas marcas diferentes para o mesmo produto é o defeito que este arquivo existe para impedir.
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
    return (
      <span className={cn("flex items-center", className)}>
        <Image
          src="/marca/icone.svg"
          alt="Resolve Aí"
          width={1412}
          height={1240}
          className="h-5 w-auto md:hidden"
        />
        <Image
          src="/marca/logo.svg"
          alt="Resolve Aí"
          width={3732}
          height={900}
          className="hidden h-5 w-auto md:block"
        />
      </span>
    );
  }

  return (
    <Image
      src="/marca/logo.svg"
      alt="Resolve Aí"
      width={3732}
      height={900}
      className={cn("h-8 w-auto", className)}
    />
  );
}
