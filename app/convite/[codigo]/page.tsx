import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ExibicaoDeCodigo } from "@/interface/componentes/campo-de-codigo";
import { EscolhaDeOrganizacao } from "@/interface/componentes/escolha-de-organizacao";
import { FormularioDePedidoDeEntrada } from "@/interface/componentes/formulario-de-pedido-de-entrada";
import {
  CaminhoDeSair,
  CLASSE_DO_CAMINHO,
  MolduraDeConta,
  ReguaDoOu,
} from "@/interface/componentes/moldura-de-conta";
import { destinoDoQr, lerAreaDoEndereco, TEXTOS_DO_QR } from "@/interface/componentes/qr-da-area";
import { TrocaPeloQr } from "@/interface/componentes/troca-pelo-qr";
import { Button } from "@/interface/componentes/ui/button";
import { resolverConviteParaTela } from "@/interface/http";
import {
  projetarContexto,
  type ContextoProjetado,
  type ConviteProjetado,
} from "@/interface/projecoes";

/**
 * ============================================================================
 *  O convite — `/convite/{codigo}` (item 86)
 * ============================================================================
 *
 * **Funciona com e sem sessão, e é a única página que lê o banco sem sessão.** Ela lê pela estrada direta
 * de `GET /convites/{codigo}` (`resolverConviteParaTela`), que o lint só deixa importar aqui e na rota
 * (ADR-0018). A situação vem decidida do servidor, e a página só escolhe a face.
 *
 * | Situação | Face |
 * |---|---|
 * | código inválido ou inexistente | *Convite não encontrado*, sem dizer qual dos dois |
 * | `sem-sessao` | nome, código travado, *Criar conta* e *Entrar*, as duas voltando para cá |
 * | `ja-participa` | a organização, para entrar nela |
 * | `pedido-pendente` | *Pedido enviado* |
 * | `pode-pedir` | o formulário de T-02 com o código travado |
 *
 * **Pedido enviado e pedido já pendente são a mesma face.** O formulário faz `router.refresh()` depois de
 * enviar, e a página refeita no servidor encontra o pendente. Nada fica em estado de cliente para se perder
 * numa recarga.
 *
 * **O cookie de organização não muda por aqui** (critério 86.5). O pedido não escreve cookie, e a única
 * troca é a da face *Já participa*, que é ação explícita.
 *
 * **Ela é também a porta do QR de cada área** (item 111), com `?area=`. É aqui porque é o único lugar que
 * lê sem sessão, e o QR precisa do nome da organização para quem ainda não entrou. Com `?area=`, quem
 * decide o destino é `destinoDoQr`; sem ele, a página é o convite de sempre. **A área não é lida aqui**, com
 * ou sem sessão: só o formato dela. Quem decide se ela existe é o registro, dentro do escopo.
 *
 * **A moldura tem uma prop chamada `convite`, e ela é outra coisa**: a coluna da outra porta do item 65.
 * Esta página não a usa. As duas palavras convivem, e o glossário fixa o sentido de *Convite*.
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return { title: lerAreaDoEndereco(await searchParams) === null ? "Convite" : TEXTOS_DO_QR.tituloDaAba };
}

export default async function PaginaDoConvite({ params, searchParams }: Props) {
  const { codigo } = await params;
  const areaId = lerAreaDoEndereco(await searchParams);
  const { resolucao, convite } = await resolverConviteParaTela(codigo);

  if (areaId !== null) {
    const destino = destinoDoQr({
      convite:
        convite === null
          ? null
          : { codigoPublico: convite.organizacao.codigoPublico, situacao: convite.situacao },
      areaId,
      ativaId: resolucao?.ativo?.organizacao.id ?? null,
      vinculos: (resolucao?.vinculos ?? []).map((v) => ({
        organizacaoId: v.organizacao.id,
        codigoPublico: v.organizacao.codigoPublico,
      })),
    });

    // `destinoDoQr` só devolve as outras saídas com o convite lido; o `convite === null` é para o tipo.
    if (destino.tipo === "nao-encontrado" || convite === null) return <FaceQrNaoEncontrado />;
    switch (destino.tipo) {
      case "convite":
      case "registro":
        return redirect(destino.para);
      case "sem-sessao":
        return <FaceQrDaArea convite={convite} areaId={areaId} />;
      case "trocar":
        return (
          <MolduraDeConta titulo={convite.organizacao.nome}>
            <TrocaPeloQr organizacaoId={destino.organizacaoId} para={destino.para} />
          </MolduraDeConta>
        );
    }
  }

  if (convite === null) return <FaceNaoEncontrado />;

  const contexto = resolucao === null ? null : projetarContexto(resolucao);

  switch (convite.situacao) {
    case "sem-sessao":
      return <FaceSemSessao convite={convite} />;
    case "ja-participa":
      return <FaceJaParticipa convite={convite} contexto={contexto} />;
    case "pedido-pendente":
      return <FacePedidoEnviado convite={convite} contexto={contexto} />;
    case "pode-pedir":
      return <FacePodePedir convite={convite} contexto={contexto} />;
  }
}

function Nome({ children }: { children: string }) {
  return <strong className="text-tinta font-semibold">{children}</strong>;
}

/** O caminho de volta: para a organização ativa, se houver; senão, sair. */
function CaminhoDeVolta({ contexto }: { contexto: ContextoProjetado | null }) {
  const ativa = contexto?.organizacaoAtiva ?? null;
  if (ativa === null) return <CaminhoDeSair />;
  return (
    <Link href="/" className={CLASSE_DO_CAMINHO}>
      Voltar para {ativa.nome}
    </Link>
  );
}

function FaceNaoEncontrado() {
  return (
    <MolduraDeConta
      titulo="Convite não encontrado"
      contexto="Confira o link com quem enviou."
      caminhos={
        <Link href="/" className={CLASSE_DO_CAMINHO}>
          Ir para o início
        </Link>
      }
    />
  );
}

function FaceSemSessao({ convite }: { convite: ConviteProjetado }) {
  const volta = encodeURIComponent(`/convite/${convite.organizacao.codigoPublico}`);
  return (
    <MolduraDeConta
      titulo={convite.organizacao.nome}
      contexto="Você recebeu um convite para participar desta organização."
    >
      <ExibicaoDeCodigo codigo={convite.organizacao.codigoPublico} rotulo="Código da organização" />
      <div className="flex flex-col gap-3">
        <Button asChild variant="marca" className="text-interface min-h-11 w-full">
          <Link href={`/criar-conta?destino=${volta}`}>Criar conta</Link>
        </Button>
        <ReguaDoOu deitada />
        <p className="text-tinta-suave text-interface">Já tem conta?</p>
        <Button asChild variant="outline" className="border-linha text-interface min-h-11 w-full">
          <Link href={`/entrar?destino=${volta}`}>Entrar</Link>
        </Button>
      </div>
    </MolduraDeConta>
  );
}

function FaceJaParticipa({
  convite,
  contexto,
}: {
  convite: ConviteProjetado;
  contexto: ContextoProjetado | null;
}) {
  const vinculo = contexto?.vinculos.find(
    (v) => v.codigoPublico === convite.organizacao.codigoPublico,
  );
  return (
    <MolduraDeConta
      titulo="Você já participa desta organização"
      contexto={<Nome>{convite.organizacao.nome}</Nome>}
      caminhos={<CaminhoDeVolta contexto={contexto} />}
    >
      {vinculo !== undefined && <EscolhaDeOrganizacao vinculos={[vinculo]} rotulo="Entrar nela" />}
    </MolduraDeConta>
  );
}

function FacePedidoEnviado({
  convite,
  contexto,
}: {
  convite: ConviteProjetado;
  contexto: ContextoProjetado | null;
}) {
  return (
    <MolduraDeConta
      titulo="Pedido enviado"
      contexto={
        <>
          Seu pedido para entrar em <Nome>{convite.organizacao.nome}</Nome> está aguardando a decisão de um Gestor.
        </>
      }
      caminhos={<CaminhoDeVolta contexto={contexto} />}
    />
  );
}

function FacePodePedir({
  convite,
  contexto,
}: {
  convite: ConviteProjetado;
  contexto: ContextoProjetado | null;
}) {
  // `pode-pedir` só existe com sessão; o `null` é inalcançável e cai na face de quem não tem sessão.
  if (contexto === null) return <FaceSemSessao convite={convite} />;
  const primeiraEntrada = contexto.vinculos.length === 0;

  return (
    <MolduraDeConta
      titulo={convite.organizacao.nome}
      contexto="Peça para entrar. Um Gestor decide."
      caminhos={<CaminhoDeVolta contexto={contexto} />}
    >
      {primeiraEntrada ? (
        // Decidido em `respostas.md` P1: nome e telefone, opcionais, como em T-02. É o único momento em
        // que a pessoa informa o próprio telefone, e é o que o Gestor lê ao decidir.
        <FormularioDePedidoDeEntrada
          codigoFixo={convite.organizacao.codigoPublico}
          nome={contexto.pessoa.nome}
        />
      ) : (
        <FormularioDePedidoDeEntrada
          codigoFixo={convite.organizacao.codigoPublico}
          variante="outra-organizacao"
          vinculos={contexto.vinculos}
        />
      )}
    </MolduraDeConta>
  );
}

/**
 * **A face de quem leu o QR de uma área sem ter entrado** (item 111). Só o nome da organização: a área não
 * é lida sem sessão. *Entrar* volta a esta mesma página com a área, e é ela que decide, com a sessão nova,
 * entre registro, troca e convite. Voltar direto ao registro abriria a organização do cookie, que pode ser
 * outra.
 */
function FaceQrDaArea({ convite, areaId }: { convite: ConviteProjetado; areaId: string }) {
  const codigo = convite.organizacao.codigoPublico;
  const volta = encodeURIComponent(`/convite/${codigo}?area=${areaId}`);
  return (
    <MolduraDeConta titulo={convite.organizacao.nome} contexto={TEXTOS_DO_QR.semSessao.contexto}>
      <div className="flex flex-col gap-3">
        <Button asChild variant="marca" className="text-interface min-h-11 w-full">
          <Link href={`/entrar?destino=${volta}`}>{TEXTOS_DO_QR.semSessao.principal}</Link>
        </Button>
        <ReguaDoOu deitada />
        <p className="text-tinta-suave text-interface">{TEXTOS_DO_QR.semSessao.apoio}</p>
        <Button asChild variant="outline" className="border-linha text-interface min-h-11 w-full">
          <Link href={`/convite/${codigo}`}>{TEXTOS_DO_QR.semSessao.secundario}</Link>
        </Button>
      </div>
    </MolduraDeConta>
  );
}

/** Código que não leva a organização, ou área fora do formato. Sem dizer qual dos dois. */
function FaceQrNaoEncontrado() {
  return (
    <MolduraDeConta
      titulo={TEXTOS_DO_QR.naoEncontrado.titulo}
      contexto={TEXTOS_DO_QR.naoEncontrado.corpo}
      caminhos={
        <Link href="/" className={CLASSE_DO_CAMINHO}>
          {TEXTOS_DO_QR.naoEncontrado.acao}
        </Link>
      }
    />
  );
}
