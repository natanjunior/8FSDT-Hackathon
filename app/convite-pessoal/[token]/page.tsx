import type { Metadata } from "next";
import Link from "next/link";

import type { ConvitePessoalLido } from "@/aplicacao/organizacao";
import { AceiteDoConvitePessoal } from "@/interface/componentes/aceite-do-convite-pessoal";
import {
  TEXTOS_DO_CONVITE_PESSOAL as TEXTOS,
  contaEmUso,
  convitePelaFace,
  jaParticipa,
  perguntaDoAceite,
} from "@/interface/componentes/convite-pessoal";
import { EscolhaDeOrganizacao } from "@/interface/componentes/escolha-de-organizacao";
import { FormularioDeCadastro } from "@/interface/componentes/formulario-de-cadastro";
import { rotuloDoPapel } from "@/interface/componentes/frases-de-participantes";
import {
  CaminhoDeSair,
  CLASSE_DO_CAMINHO,
  MolduraDeConta,
  ReguaDoOu,
} from "@/interface/componentes/moldura-de-conta";
import { Button } from "@/interface/componentes/ui/button";
import { resolverConvitePessoalParaTela } from "@/interface/http";
import { projetarContexto, type ContextoProjetado } from "@/interface/projecoes";

/**
 * ============================================================================
 *  O convite pessoal — `/convite-pessoal/{token}` (item 121, ADR-0021)
 * ============================================================================
 *
 * **A segunda página que lê o banco sem sessão.** Ela lê pela estrada direta de
 * `GET /convites-pessoais/{token}` (`resolverConvitePessoalParaTela`), que o lint só deixa importar aqui e
 * na rota. A situação vem decidida do servidor, e a página só escolhe a face.
 *
 * | Situação | Face |
 * |---|---|
 * | não vale | *Este convite não vale mais.*, sem dizer por quê |
 * | `sem-sessao` | o nome da pessoa, e o formulário de criar conta com o nome preenchido e o token oculto |
 * | `pode-aceitar` | *Entrar no {organização} como {papel}?*, com a conta em uso e o caminho de sair |
 * | `ja-participa` | a organização, para entrar nela |
 *
 * **O formulário de criar conta mora aqui**, e não em `/criar-conta`: para preencher o nome lá, a outra
 * página teria de ler pelo token sem sessão também, ou receber o nome na URL, que fica no histórico. **O
 * e-mail não vem preenchido**: contato só é legível dentro da organização do vínculo.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Convite" };

type Props = { params: Promise<{ token: string }> };

export default async function PaginaDoConvitePessoal({ params }: Props) {
  const { token } = await params;
  const { resolucao, convite } = await resolverConvitePessoalParaTela(token);

  if (convite === null) return <FaceNaoVale />;

  const contexto = resolucao === null ? null : projetarContexto(resolucao);

  switch (convite.situacao) {
    case "sem-sessao":
      return <FaceSemSessao convite={convite} token={token} />;
    case "pode-aceitar":
      return <FacePodeAceitar convite={convite} token={token} contexto={contexto} />;
    case "ja-participa":
      return <FaceJaParticipa convite={convite} contexto={contexto} />;
  }
}

function FaceNaoVale() {
  return (
    <MolduraDeConta
      titulo={TEXTOS.naoVale}
      contexto={TEXTOS.naoValeContexto}
      caminhos={
        <Link href="/" className={CLASSE_DO_CAMINHO}>
          Ir para o início
        </Link>
      }
    />
  );
}

function FaceSemSessao({ convite, token }: { convite: ConvitePessoalLido; token: string }) {
  const volta = `/convite-pessoal/${token}`;
  return (
    <MolduraDeConta
      titulo={convite.pessoa.nome}
      contexto={convitePelaFace(convite.organizacao.nome, rotuloDoPapel(convite.papel))}
    >
      <FormularioDeCadastro convite={token} nomeInicial={convite.pessoa.nome} destino={volta} />
      <div className="flex flex-col gap-3">
        <ReguaDoOu deitada />
        <p className="text-tinta-suave text-interface">{TEXTOS.jaTenhoConta}</p>
        <Button asChild variant="outline" className="border-linha text-interface min-h-11 w-full">
          <Link href={`/entrar?destino=${encodeURIComponent(volta)}`}>Entrar</Link>
        </Button>
      </div>
    </MolduraDeConta>
  );
}

function FacePodeAceitar({
  convite,
  token,
  contexto,
}: {
  convite: ConvitePessoalLido;
  token: string;
  contexto: ContextoProjetado | null;
}) {
  return (
    <MolduraDeConta
      titulo={perguntaDoAceite(convite.organizacao.nome, rotuloDoPapel(convite.papel))}
      contexto={contexto === null ? undefined : contaEmUso(contexto.pessoa.nome)}
      caminhos={<CaminhoDeSair />}
    >
      <AceiteDoConvitePessoal token={token} />
    </MolduraDeConta>
  );
}

function FaceJaParticipa({
  convite,
  contexto,
}: {
  convite: ConvitePessoalLido;
  contexto: ContextoProjetado | null;
}) {
  const vinculo = contexto?.vinculos.find((v) => v.organizacaoId === convite.organizacao.id);
  return (
    <MolduraDeConta
      titulo={jaParticipa(convite.organizacao.nome)}
      caminhos={
        <Link href="/" className={CLASSE_DO_CAMINHO}>
          Ir para o início
        </Link>
      }
    >
      {vinculo !== undefined && <EscolhaDeOrganizacao vinculos={[vinculo]} rotulo="Entrar nela" />}
    </MolduraDeConta>
  );
}
