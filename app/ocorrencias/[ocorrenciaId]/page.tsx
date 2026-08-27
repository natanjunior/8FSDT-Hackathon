import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { OcorrenciaNaoEncontrada, verOcorrencia } from "@/aplicacao/ocorrencia";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { rotuloDePrioridade } from "@/interface/componentes/rotulos";
import { lerFiltroDeOcorrenciasDaUrl, resolverEscopoParaTela } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";

/**
 * **T-05 · Ocorrência**, na forma mínima que o critério 11.7 encomenda: os **blocos 1 e 2** do
 * inventário — identidade e conteúdo. A linha do tempo (bloco 3) é o item 29, a conversa (bloco 4) é o
 * 30, e os onze comandos são os itens 16 a 27.
 *
 * **Endereço próprio, e é o mais importante do produto** (inventário): `/ocorrencias/{id}` é *"o link
 * que substitui descrever a ocorrência por WhatsApp — o comportamento exato que o produto veio
 * substituir"*. Por isso ele resolve de verdade e sobrevive a um recarregar, em vez de ser pintado com o
 * payload do `201` e quebrar na segunda visita.
 *
 * **A leitura vai pela estrada direta**, como T-09 e o shell: `app/` não monta repositório, e um `fetch`
 * interno custaria o salto HTTP que a §5 do contrato recusou.
 */
export const dynamic = "force-dynamic";

/**
 * **O `de=` é reconstruído, nunca repassado cru** — item 15, critério 15.3.
 *
 * Ele vem de uma URL que qualquer pessoa pode ter editado. Passar a *query string* adiante sem olhar seria
 * confiar em texto de fora; em vez disso ela atravessa a **mesma** leitura que a lista usa, e só os quatro
 * parâmetros conhecidos voltam para o endereço. Filtro estragado no `de=` degrada para o *Voltar* limpo —
 * a lista sem recorte —, que é o pior caso aceitável.
 *
 * **`catch {}` sem tipo é o único caminho honesto aqui**, e não é engolir erro: qualquer coisa que a
 * leitura recuse é lixo vindo de fora, e a resposta certa é a lista inteira — não uma tela de erro em
 * T-05, que é a tela que precisa abrir para quem recebeu o link por mensagem.
 */
function destinoDeVolta(de: string | undefined): string {
  if (de === undefined || de === "") return "/ocorrencias";
  try {
    const filtro = lerFiltroDeOcorrenciasDaUrl(new URLSearchParams(de));
    const consulta = new URLSearchParams();
    if (filtro.status !== undefined) consulta.set("status", filtro.status.join(","));
    if (filtro.categoriaId !== undefined) consulta.set("categoriaId", filtro.categoriaId.join(","));
    if (filtro.prioridade !== undefined) consulta.set("prioridade", filtro.prioridade.join(","));
    if (filtro.apenasDoAutor === true) consulta.set("autor", "eu");
    const texto = consulta.toString();
    return texto === "" ? "/ocorrencias" : `/ocorrencias?${texto}`;
  } catch {
    return "/ocorrencias";
  }
}

export default async function Ocorrencia({
  params,
  searchParams,
}: {
  params: Promise<{ ocorrenciaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.ler_propria");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") redirect("/");

  const { ocorrenciaId } = await params;

  const parametros = await searchParams;
  const voltarPara = destinoDeVolta(typeof parametros.de === "string" ? parametros.de : undefined);

  let lida;
  try {
    lida = await verOcorrencia(escopo.repos.ocorrencias, ocorrenciaId);
  } catch (erro) {
    // `404` indistinguível de "de outra organização" — §6.3. A tela não confirma existência.
    if (erro instanceof OcorrenciaNaoEncontrada) notFound();
    throw erro;
  }

  // **`escopo.ctx`, nao `escopo.resolucao`.** Depois dos dois `if` acima o TypeScript ja estreitou
  // `escopo` para a variante `"pronto"`, que carrega `ctx` — e `ContextoDaRequisicao` e quem tem
  // `pessoaId` e `vinculo`. `ResolucaoDeContexto` **nao tem `pessoaId`**: la ele mora em
  // `resolucao.sessao.pessoaId`, e `ativo` e `VinculoNaOrganizacao`, o que ainda exigiria um `!`.
  const vinculo = escopo.ctx.vinculo;
  if (!vinculo.pode("ocorrencia.ler_todas") && lida.autor.pessoaId !== escopo.ctx.pessoaId) {
    notFound();
  }

  const detalhe = projetarOcorrenciaDetalhe(lida, {
    pessoaId: escopo.ctx.pessoaId,
    permissoes: vinculo.permissoes,
  });

  return (
    <MolduraDeTela titulo={detalhe.titulo}>
      {/* **Bloco 1 · Identidade.** `statusRotulo` sem rolar — é a resposta literal a "o que aconteceu
          com o meu pedido?". **A-5:** o status e a prioridade carregam a palavra, sempre. */}
      <section className="border-linha bg-superficie flex flex-col gap-2 rounded-md border px-4 py-3.5">
        <span className="text-tinta-fraca text-xs tracking-wide uppercase">Situação</span>
        <span className="text-tinta text-base leading-snug font-semibold">
          {detalhe.statusRotulo}
        </span>
        <dl className="text-tinta-suave grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">Prioridade</dt>
          <dd>{rotuloDePrioridade(detalhe.prioridade)}</dd>
          <dt className="font-medium">Categoria</dt>
          <dd>{detalhe.categoria.nome}</dd>
          <dt className="font-medium">Onde</dt>
          <dd>
            {detalhe.area.nome} · {detalhe.area.tipo === "comum" ? "área comum" : "unidade privativa"}
            {detalhe.localizacaoComplemento !== null && ` — ${detalhe.localizacaoComplemento}`}
          </dd>
          <dt className="font-medium">Registrada por</dt>
          <dd>{detalhe.autor.nome}</dd>
          <dt className="font-medium">Quando</dt>
          <dd>{new Date(detalhe.registradaEm).toLocaleString("pt-BR")}</dd>
        </dl>
      </section>

      {/* **Bloco 2 · Conteúdo.** O anexo entra aqui no item 13b. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-tinta text-sm font-semibold">O que foi relatado</h2>
        <p className="text-tinta-suave text-sm leading-relaxed whitespace-pre-line">
          {detalhe.descricao}
        </p>
      </section>

      {/* **A primeira entrada da trilha** — a prova, para quem acabou de reclamar, de que o pedido
          existe. É o critério 11.2 visível na interface, e não só em teste. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-tinta text-sm font-semibold">Histórico</h2>
        <p className="text-tinta-suave text-sm">
          {detalhe.ultimaTransicao.statusAnterior === null
            ? "Registrada"
            : `De ${detalhe.ultimaTransicao.statusAnterior} para ${detalhe.ultimaTransicao.statusNovo}`}{" "}
          por {detalhe.ultimaTransicao.autor.nome} em{" "}
          {new Date(detalhe.ultimaTransicao.ocorreuEm).toLocaleString("pt-BR")}.
        </p>
      </section>

      {/*
        **A barra de ações, com `acoesDisponiveis` vazia.** A tela renderiza *exatamente*
        `acoesDisponiveis` e nada além — hoje a lista é vazia porque nenhum dos onze endpoints de comando
        foi construído, e vazia é verdade sobre o produto de hoje. No lugar entra a nota tracejada que o
        shell já usa: **andaime declarado, não UI de produto**, e sai no item 16.
      */}
      {detalhe.acoesDisponiveis.length === 0 && (
        <p className="border-linha bg-superficie text-tinta-suave rounded-md border border-dashed px-3 py-2.5 text-xs leading-relaxed">
          Os comandos da ocorrência — analisar, atribuir, atender, resolver — chegam nos próximos itens.
        </p>
      )}

      <Link href={voltarPara} className="text-marca py-1 text-sm underline underline-offset-4">
        Voltar
      </Link>
    </MolduraDeTela>
  );
}
