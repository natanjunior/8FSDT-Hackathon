import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, listarCategorias } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CaminhoDaPagina } from "@/interface/componentes/caminho-da-pagina";
import { DepoisDeRegistrar } from "@/interface/componentes/depois-de-registrar";
import { FormularioDeOcorrencia } from "@/interface/componentes/formulario-de-ocorrencia";
import { lerAreaDoEndereco, situacaoDaAreaInicial } from "@/interface/componentes/qr-da-area";
import {
  vazioDoRegistro,
  type FaltaNoRegistro,
} from "@/interface/componentes/registro-de-ocorrencia";
import { rotulosDeStatus } from "@/interface/componentes/rotulos";
import { buttonVariants } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import { cn } from "@/interface/componentes/utilitarios";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-04 · Registrar ocorrência** — *"Preciso avisar de um problema."*
 *
 * **A tela mais restringida do inventário, e a única cujo layout é medido em segundos.** O RNF6 dá menos
 * de um minuto do toque no atalho ao `201`, incluindo foto. Tudo aqui se subordina a isso.
 *
 * **A leitura vai pela estrada direta** (contrato §5): `app/` não pode montar repositório, e um `fetch`
 * interno custaria o salto HTTP — que na tela cronometrada é o salto que não cabe.
 *
 * **As duas listas vêm só com as ativas**, que é o padrão desta tela — ao contrário de T-09 e T-14, que
 * trazem as inativas porque é lá que se reativa. Salvo com `?area=`, quando as áreas vêm todas, para que a
 * área do QR seja procurada entre elas (item 111). Ativa vem escolhida; desativada, inexistente ou de
 * outra organização abre sem área, com um aviso só, que não diz qual dos casos é.
 *
 * **A segunda coluna da tela grande é conteúdo, não moldura** (item 44l). O painel *Depois de registrar*
 * nasce aqui, de servidor, e chega ao formulário por propriedade: é ele quem sabe quando o formulário
 * virou bloco terminal — no `409` da foto já reivindicada — e tem de esconder o painel junto, para que
 * *"Depois de registrar"* não fique ao lado de *"Esta ocorrência já foi registrada."*
 *
 * **A foto não está aqui, e é decisão da spec (§3.6):** ela é o *primeiro alvo da tela* por decisão do
 * protótipo, e o item 13a a insere no topo sem reordenar nada.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Registrar ocorrência" };

export default async function RegistrarOcorrencia({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const areaDoQr = lerAreaDoEndereco(await searchParams);
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.registrar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") redirect("/");

  const [categorias, todasAsAreas] = await Promise.all([
    listarCategorias(escopo.repos.categorias, { incluirInativas: false }),
    // **Com a área do QR, as inativas entram** (item 111): é a mesma leitura escopada, depois da troca de
    // organização, e as ativas saem em memória. A área do endereço só é procurada aqui dentro.
    listarAreas(escopo.repos.areas, { incluirInativas: areaDoQr !== null }),
  ]);
  const areas = todasAsAreas.filter((area) => area.ativa);
  const daArea = situacaoDaAreaInicial(todasAsAreas, areaDoQr);

  /**
   * **O nome da organização sai de `resolucao.ativo`**, como em T-15
   * (`app/(casca)/configuracao/page.tsx`). `ResolucaoDeContexto` **não tem** `organizacaoAtiva` — esse
   * nome é da projeção `ContextoProjetado`, e chamar `projetarContexto` aqui só para ler uma palavra
   * projetaria vínculos e pedidos junto. O `null` é inalcançável com `situacao: "pronto"`, mas o tipo não
   * sabe disso; o `redirect` é o mesmo que o `app/(foco)/layout.tsx` já faz uma camada acima, e nunca
   * chega a acontecer duas vezes.
   */
  const ativo = escopo.resolucao.ativo;
  if (ativo === null) redirect("/organizacao");

  /**
   * **O caminho no topo, em toda face** (critério 106.5): era a única página-formulário sem ele, e no
   * celular a tela não tinha um único link. É a forma de um nível das duas páginas de participante.
   */
  const caminho = (
    <CaminhoDaPagina anterior={{ rotulo: "Ocorrências", href: "/ocorrencias" }} atual="Registrar ocorrência" />
  );

  /**
   * **O subtítulo repete a organização, e T-04 é a única tela que faz isso.** No celular o seletor da
   * barra superior corta o nome, e registrar na organização errada é o erro que aquela barra existe para
   * evitar.
   */
  const cabecalho = (
    <>
      {caminho}
      <CabecalhoDaPagina titulo="Registrar ocorrência" fato={`Em ${ativo.organizacao.nome}.`} />
    </>
  );

  const faltando: FaltaNoRegistro[] = [
    ...(categorias.length === 0 ? (["categorias"] as const) : []),
    ...(areas.length === 0 ? (["areas"] as const) : []),
  ];

  if (faltando.length > 0) {
    // `escopo.ctx` — `escopo` ja esta estreitado para `"pronto"` pelos dois `if` acima.
    const vazio = vazioDoRegistro(faltando, escopo.ctx.vinculo.pode("organizacao.configurar"));

    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <div className="border-linha bg-superficie rounded-lg border shadow-sm">
          <Empty className="px-6 py-14 md:px-6 md:py-14">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="border-linha bg-background text-tinta-suave mb-3 size-13 rounded-lg border"
              >
                <CircleAlert aria-hidden="true" className="size-5.5" />
              </EmptyMedia>
              <EmptyTitle className="text-titulo-bloco text-tinta">
                {vazio.titulo}
              </EmptyTitle>
              <EmptyDescription className="text-corpo text-tinta-suave">{vazio.corpo}</EmptyDescription>
            </EmptyHeader>
            {vazio.acao !== null && (
              <EmptyContent>
                <Link
                  href={vazio.acao.href}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "border-linha text-tinta text-interface min-h-11 rounded-sm px-4",
                  )}
                >
                  {vazio.acao.rotulo}
                </Link>
              </EmptyContent>
            )}
          </Empty>
        </div>
      </div>
    );
  }

  /** Os quatro do ciclo, **na coluna de quem lê** (item 31). */
  const rotulos = rotulosDeStatus(escopo.lente);
  const passos = [rotulos.aberta, rotulos.em_analise, rotulos.em_atendimento, rotulos.resolvida];

  return (
    <div className="flex flex-col gap-6">
      {cabecalho}
      <FormularioDeOcorrencia
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, icone: c.icone }))}
        areas={areas.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo }))}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
        painel={<DepoisDeRegistrar passos={passos} />}
        areaInicial={daArea.tipo === "ativa" ? daArea.areaId : undefined}
        areaIndisponivel={daArea.tipo === "indisponivel"}
      />
    </div>
  );
}
