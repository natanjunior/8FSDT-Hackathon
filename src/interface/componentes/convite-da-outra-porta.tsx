import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/interface/componentes/ui/button";

const ID_DO_CONVITE = "titulo-do-convite";

/**
 * ============================================================================
 *  O lado que convida — item 65
 * ============================================================================
 *
 * **`/organizacao` e `/organizacao/criar` são a mesma escolha vista dos dois lados.** O lado que age é o
 * cartão da moldura; este é o outro, e a assimetria é proposital: **não é cartão**, vive sobre o fundo da
 * página, para que o olho saiba qual das duas colunas é a tela.
 *
 * **O botão é link**, porque navega e não muda estado, e é de contorno, porque o principal da tela é o do
 * cartão. O texto é da página, que sabe de que lado está; esta peça só dá a forma.
 *
 * **Três itens, sempre.** O design fixa três linhas de cada lado, e a tupla impede a quarta.
 */
export function ConviteDaOutraPorta({
  titulo,
  frase,
  itens,
  rotulo,
  href,
}: {
  titulo: string;
  frase: string;
  itens: readonly [string, string, string];
  rotulo: string;
  href: string;
}) {
  return (
    <section aria-labelledby={ID_DO_CONVITE} className="flex flex-col gap-4">
      <h2 id={ID_DO_CONVITE} className="text-titulo-bloco text-tinta">
        {titulo}
      </h2>
      <p className="text-corpo text-tinta-suave">{frase}</p>
      <ul className="flex flex-col gap-2.5">
        {itens.map((item) => (
          <li key={item} className="text-interface text-tinta flex items-center gap-2">
            <Check aria-hidden="true" className="text-ok size-[15px] shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="border-linha text-interface min-h-11 w-full">
        <Link href={href}>{rotulo}</Link>
      </Button>
    </section>
  );
}
