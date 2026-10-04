import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import { CodigoDaOrganizacao } from "@/interface/componentes/codigo-da-organizacao";
import { CopiaDoLink } from "@/interface/componentes/link-do-convite";
import { QrDoLink } from "@/interface/componentes/qr";

/**
 * ============================================================================
 *  T-15 · o cartão *Convidar pessoas* (item 120, bloco 10)
 * ============================================================================
 *
 * **Era a página `/convidar`**, e virou cartão da aba de participantes, por ordem do dono em 03/10/2026.
 * Três colunas, na ordem dele: **o código, exatamente como na Identidade** — a mesma peça, com o *Copiar*
 * e a frase do cartaz —, **o link**, que se copia e não se escreve, e **o QR**.
 *
 * **Três colunas só a partir de `xl`.** O código pede até 398 px (`campo-de-codigo.tsx:123`) e o QR 224;
 * a 1024 px, com a barra lateral, cada terço do cartão dá ~210 px, e o código cortaria — o defeito do
 * item 93. As trilhas são `minmax(0,24.875rem) · 1fr · auto`: o código com o teto dele, o texto do link no
 * meio e o QR na largura dele. Abaixo de `xl`, uma coluna.
 */
const ROTULO = "text-rotulo-coluna text-tinta-suave font-mono uppercase";
const COLUNA = "border-linha-suave flex min-w-0 flex-col gap-2.5 p-[15px] md:px-6 md:py-5";

export function ConviteDaOrganizacao({
  organizacao,
  link,
}: {
  organizacao: { nome: string; codigoPublico: string };
  link: string;
}) {
  return (
    <Cartao tituloId="convidar">
      <CabecaDoCartao
        id="convidar"
        titulo="Convidar pessoas"
        apoio={`Três formas de chegar ao pedido de entrada em ${organizacao.nome}.`}
      />
      <dl className="grid xl:grid-cols-[minmax(0,24.875rem)_minmax(0,1fr)_auto]">
        <div className={COLUNA}>
          <dt className={ROTULO}>Código da organização</dt>
          <CodigoDaOrganizacao codigo={organizacao.codigoPublico} />
        </div>
        <div className={`${COLUNA} border-t xl:border-t-0 xl:border-l`}>
          <dt className={ROTULO}>Link da organização</dt>
          <dd className="text-interface text-tinta max-w-110">
            O link leva ao pedido de entrada nesta organização. Mande por mensagem ou cole no grupo.
          </dd>
          <dd>
            <CopiaDoLink link={link} />
          </dd>
        </div>
        <div className={`${COLUNA} border-t xl:border-t-0 xl:border-l`}>
          <dt className={ROTULO}>QR do convite</dt>
          <dd className="text-interface text-tinta max-w-110">
            Quem preferir pode usar o QR, que leva ao mesmo convite.
          </dd>
          <dd>
            <QrDoLink link={link} rotulo={`QR do link de convite para ${organizacao.nome}`} />
          </dd>
        </div>
      </dl>
    </Cartao>
  );
}
