import type { VinculoNoMenu } from "@/interface/componentes/lista-de-organizacoes";
import { MarcaDoProduto } from "@/interface/componentes/marca";
import { MenuDePessoa } from "@/interface/componentes/casca/menu-de-pessoa";
import { SeletorDeOrganizacao } from "@/interface/componentes/casca/seletor-de-organizacao";

/**
 * **A barra superior das telas de dentro.**
 *
 * Ela é 56 px no celular e 60 a partir de `md` (guia §4), e hospeda o gatilho da gaveta abaixo de `md` —
 * o `children` é por onde o layout passa esse gatilho.
 *
 * **O sino entra entre o seletor e a pessoa** (item 117), e só na casca: a moldura de foco não o passa. O
 * sino e o avatar não encolhem; **quem cede largura é o seletor**, que já trunca o nome. Os dois `min-w-0`
 * são o que o deixa ceder: sem eles o gatilho não encolhe abaixo do nome inteiro, e a barra rolava 32 px a
 * 320 px antes mesmo do sino (item 93).
 */
export function BarraSuperior({
  vinculos,
  organizacaoAtivaId,
  nomeDaPessoa,
  emailDaPessoa,
  sino,
  children,
}: {
  vinculos: readonly VinculoNoMenu[];
  organizacaoAtivaId: string;
  nomeDaPessoa: string;
  /** O e-mail de entrada, para o cabeçalho do menu de pessoa (item 44i); `null` sem e-mail do provedor. */
  emailDaPessoa: string | null;
  /** O sino do item 117, já no `Suspense`; ausente na moldura de foco. */
  sino?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-linha bg-superficie sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 md:h-[60px] md:px-6">
      {children}
      <MarcaDoProduto tamanho="barra" />
      <div className="ml-auto flex min-w-0 items-center gap-2 [&>[data-slot=select-trigger]]:min-w-0">
        <SeletorDeOrganizacao vinculos={vinculos} organizacaoAtivaId={organizacaoAtivaId} />
        {sino}
        <MenuDePessoa nomeDaPessoa={nomeDaPessoa} emailDaPessoa={emailDaPessoa} />
      </div>
    </header>
  );
}
