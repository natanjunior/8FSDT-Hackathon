import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import { EdicaoDeNome } from "@/interface/componentes/edicao-de-nome";
import { buttonVariants } from "@/interface/componentes/ui/button";
import { cn } from "@/interface/componentes/utilitarios";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-16 · Meus dados** — *"o que é meu, e como eu entro?"*
 *
 * **Não é subrota de `/configuracao`**: configuração é **da organização**, e o item 48 separou os dois
 * assuntos justamente porque quem administra a organização não está administrando a si mesmo. Dado
 * pessoal é global, e por isso também não tem lugar na barra lateral, cujo `aria-label` é *"Nesta
 * organização"*. **O caminho é o menu de pessoa**, que abre com o nome e o e-mail de quem está na sessão
 * e tem *Meus dados* como primeiro item.
 *
 * **A tela grande segue T-15** (item 44i, guia §7): dois cartões de leitura, e *Editar* só na
 * identidade, com o mesmo modal do nome. *Acesso* é lista de definição, em duas metades na tela grande. O
 * que não se edita, como o e-mail, não oferece edição, e a tela não explica a ausência.
 *
 * **Nenhuma requisição nova na abertura, e é a única tela do produto assim:** o nome e o e-mail vêm da
 * resolução de contexto que a casca já fez. O desfecho do salvamento é um aviso, que mora no layout raiz
 * e sobrevive à atualização da página.
 *
 * **Quem não tem vínculo nenhum não chega aqui**, porque a casca exige `qualquer-vinculo-ativo` e T-02
 * não tem barra superior. Para essa pessoa o ponto de correção continua sendo o campo `nome` de
 * `POST /pedidos-de-entrada`, pré-preenchido. É a mesma assimetria que a §4.4 do contrato já declara
 * para `POST /organizacoes`: contrato aberto, tela fechada.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meus dados" };

/** O rótulo de um item da lista de definição: o papel de rótulo de coluna do guia §3. */
const ROTULO = "text-rotulo-coluna text-tinta-suave font-mono uppercase";

export default async function MeusDados() {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  // `qualquer-vinculo-ativo` nunca produz `sem-permissao`; a guarda existe para o tipo, não para o caso.
  if (escopo.situacao === "sem-permissao") redirect("/ocorrencias");

  const { nome, email } = escopo.resolucao.sessao;

  return (
    <div className="flex flex-col gap-5.5">
      <CabecalhoDaPagina titulo="Meus dados" fato="Valem em todas as organizações em que você está." />

      {/* **Identidade antes de mecanismo**, a mesma regra do geral para o particular que ordena a barra
          lateral e que T-15 usa: o que é seu vem antes de como você entra. */}
      <Cartao tituloId="identidade">
        <CabecaDoCartao
          id="identidade"
          titulo="Identidade"
          acao={<EdicaoDeNome alvo="pessoa" nome={nome} />}
        />
        <dl className="flex flex-col gap-2 p-[15px] md:px-6 md:py-5">
          <dt className={ROTULO}>Nome</dt>
          <dd className="text-titulo-bloco text-tinta font-medium wrap-break-word">{nome}</dd>
          <dd className="text-meta text-tinta-suave">
            É como os Gestores veem você, inclusive nas transições que você já registrou.
          </dd>
        </dl>
      </Cartao>

      <Cartao tituloId="acesso">
        <CabecaDoCartao id="acesso" titulo="Acesso" />
        <dl className="grid lg:grid-cols-2">
          <div className="flex flex-col gap-1.5 p-[15px] md:px-6 md:py-5">
            <dt className={ROTULO}>E-mail de entrada</dt>
            <dd className="text-interface text-tinta break-all">{email ?? "Sem e-mail"}</dd>
            <dd className="text-meta text-tinta-suave">
              É com ele que você entra e recebe o link de recuperação de senha.
            </dd>
          </div>
          <div className="border-linha-suave grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-t p-[15px] md:px-6 md:py-5 lg:border-t-0 lg:border-l">
            <dt className={cn(ROTULO, "col-start-1")}>Senha</dt>
            {/* **Os pontos são desenho**, e quem usa leitor de tela ouve *oculta*. */}
            <dd className="text-interface text-tinta-suave col-start-1 font-mono tracking-[0.2em]">
              <span aria-hidden="true">••••••••</span>
              <span className="sr-only">oculta</span>
            </dd>
            {/* **Aponta, em vez de duplicar.** T-12 aceita quem tem sessão desde a D-6b-5, e é a única
                porta de trocar a senha que o produto tem. **O nome diz o que acontece** (critério
                106.12): um e-mail com link, e não a troca aqui. */}
            <dd className="col-start-2 row-span-2 row-start-1">
              <Link
                href="/redefinir-senha"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "border-linha text-interface min-h-11 rounded-sm px-4 has-[>svg]:px-4",
                )}
              >
                Receber link para trocar a senha
                <ArrowRight aria-hidden="true" />
              </Link>
            </dd>
          </div>
        </dl>
      </Cartao>
    </div>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("qualquer-vinculo-ativo");
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fmeus-dados");
    throw erro;
  }
}
