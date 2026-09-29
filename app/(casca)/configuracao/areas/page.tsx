import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { FRASE_DAS_AREAS } from "@/interface/componentes/frases-da-configuracao";
import { ModalDeArea } from "@/interface/componentes/modal-de-area";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { TabelaDeAreas } from "@/interface/componentes/tabela-de-areas";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";

/**
 * **T-14 · Áreas** — *"As áreas descrevem este lugar?"*
 *
 * **Esta lista morava em `/configuracao`, junto com a de Categorias, até 16/09/2026.** O argumento da
 * separação está no arquivo pai (`app/(casca)/configuracao/page.tsx`), escrito uma vez.
 *
 * **Alvo primário: tela grande**, pela mesma razão de T-09. **A leitura vai pela estrada direta**
 * (contrato §5), e a lista vem com as inativas, porque é aqui que se reativa o que foi desativado e
 * porque a ordem se grava com a lista inteira (item 50).
 *
 * **O fato vem de `FRASE_DAS_AREAS`** (item 64): diz o que a lista é, e a contagem vai no fim.
 *
 * **Criar e editar são modal desde o item 44k**, e as duas rotas próprias saíram com ele. A contagem de
 * ocorrências que mantêm o tipo anterior deixou de viajar pelo endereço: ela vai no aviso de atenção, que
 * fica na tela até ser fechado.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Áreas" };

export default async function Areas() {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Áreas" permissao="organizacao.configurar" />;
  }

  const areas = await listarAreas(escopo.repos.areas, { incluirInativas: true });
  const organizacaoId = escopo.ctx.vinculo.organizacaoId;
  const ativas = areas.filter((area) => area.ativa).length;

  return (
    <div className="flex flex-col gap-5.5">
      <CabecalhoDaPagina
        titulo="Áreas"
        fato={<Fato ativas={ativas} total={areas.length} />}
        acao={<ModalDeArea modo="criar" organizacaoId={organizacaoId} />}
      />

      <TabelaDeAreas itens={areas.map(projetarArea)} organizacaoId={organizacaoId} />
    </div>
  );
}

/** O fato do cabeçalho: a frase de `frases-da-configuracao.ts`, e os números em mono, como T-08 os escreve. */
function Fato({ ativas, total }: { ativas: number; total: number }) {
  const numero = (valor: number) => <span className="font-mono tabular-nums">{valor}</span>;
  return (
    <>
      {FRASE_DAS_AREAS} {numero(ativas)} ativas de {numero(total)}.
    </>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("organizacao.configurar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao%2Fareas");
    throw erro;
  }
}
