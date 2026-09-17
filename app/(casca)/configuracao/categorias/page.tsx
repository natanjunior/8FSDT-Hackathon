import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarCategorias } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { ModalDeCategoria } from "@/interface/componentes/modal-de-categoria";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { TabelaDeCategorias } from "@/interface/componentes/tabela-de-categorias";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarCategoria } from "@/interface/projecoes";

/**
 * **T-09 · Categorias** — *"As categorias que o Solicitante escolhe estão certas?"*
 *
 * **Esta lista morava em `/configuracao`, junto com a de Áreas, até 16/09/2026.** O argumento da separação
 * está no arquivo pai (`app/(casca)/configuracao/page.tsx`), escrito uma vez — repetido aqui, ele se
 * desatualizaria pela metade.
 *
 * **Alvo primário: tela grande.** É trabalho de escritório, feito sentado, uma vez — o RNF6 cronometra
 * T-04, não esta.
 *
 * **A leitura vai pela estrada direta** (contrato §5): `app/` não pode montar repositório, e um `fetch`
 * interno custaria o salto HTTP que a §5 recusou.
 *
 * **A lista vem com as inativas** — `incluirInativas: true` —, porque é aqui que se reativa o que foi
 * desativado, e porque a ordem se grava com a lista inteira (item 50).
 *
 * **Criar e editar são modal desde o item 44k**, e as duas rotas próprias saíram com ele. A página não lê
 * mais o endereço: filtro e busca vivem na tabela, e o desfecho de cada escrita vem por aviso.
 */
export const dynamic = "force-dynamic";

export default async function Categorias() {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Categorias" permissao="organizacao.configurar" />;
  }

  const categorias = await listarCategorias(escopo.repos.categorias, { incluirInativas: true });
  const organizacaoId = escopo.ctx.vinculo.organizacaoId;
  const ativas = categorias.filter((categoria) => categoria.ativa).length;

  return (
    <div className="flex flex-col gap-5.5">
      <CabecalhoDaPagina
        titulo="Categorias"
        fato={<Fato ativas={ativas} total={categorias.length} />}
        acao={<ModalDeCategoria modo="criar" organizacaoId={organizacaoId} />}
      />

      <TabelaDeCategorias
        itens={categorias.map(projetarCategoria)}
        organizacaoId={organizacaoId}
      />
    </div>
  );
}

/**
 * O fato do cabeçalho, com os números em mono, como T-08 os escreve.
 *
 * **A frase da semente é incondicional** e é a que o inventário obriga: ela diz como a organização nasceu,
 * e continua verdadeira depois de a pessoa mexer na lista.
 */
function Fato({ ativas, total }: { ativas: number; total: number }) {
  const numero = (valor: number) => <span className="font-mono tabular-nums">{valor}</span>;
  return (
    <>
      {numero(ativas)} ativas de {numero(total)}. Sete foram criadas junto com a organização.
    </>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("organizacao.configurar");
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao%2Fcategorias");
    throw erro;
  }
}
