import type { VinculoNoMenu } from "@/interface/componentes/menu-de-organizacao";
import { MenuDePessoa } from "@/interface/componentes/casca/menu-de-pessoa";
import { SeletorDeOrganizacao } from "@/interface/componentes/casca/seletor-de-organizacao";

/**
 * **A barra superior das telas de dentro.**
 *
 * Ela é 56 px no celular e 60 a partir de `md` (guia §4), e hospeda o gatilho da gaveta abaixo de `md` —
 * o `children` é por onde o layout passa esse gatilho.
 */
export function BarraSuperior({
  vinculos,
  organizacaoAtivaId,
  nomeDaPessoa,
  emailDaPessoa,
  children,
}: {
  vinculos: readonly VinculoNoMenu[];
  organizacaoAtivaId: string;
  nomeDaPessoa: string;
  /** O e-mail de entrada, para o cabeçalho do menu de pessoa (item 44i); `null` sem e-mail do provedor. */
  emailDaPessoa: string | null;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-linha bg-superficie sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 md:h-[60px] md:px-6">
      {children}
      <span className="text-marca text-rotulo-coluna font-mono font-medium tracking-[0.11em] uppercase">
        Resolve Aí
      </span>
      <div className="ml-auto flex items-center gap-2">
        <SeletorDeOrganizacao vinculos={vinculos} organizacaoAtivaId={organizacaoAtivaId} />
        <MenuDePessoa nomeDaPessoa={nomeDaPessoa} emailDaPessoa={emailDaPessoa} />
      </div>
    </header>
  );
}
