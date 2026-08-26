import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, listarCategorias } from "@/aplicacao/organizacao";
import { FormularioDeOcorrencia } from "@/interface/componentes/formulario-de-ocorrencia";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
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
 * **As duas listas vêm só com as ativas**, que é o padrão desta tela — ao contrário de T-09, que traz as
 * inativas porque é lá que se reativa.
 *
 * **A foto não está aqui, e é decisão da spec (§3.6):** ela é o *primeiro alvo da tela* por decisão do
 * protótipo, e o item 13a a insere no topo sem reordenar nada. Um botão que não faz nada custaria o alvo
 * de toque mais visível da tela por nada.
 */
export const dynamic = "force-dynamic";

export default async function RegistrarOcorrencia() {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.registrar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") redirect("/");

  const [categorias, areas] = await Promise.all([
    listarCategorias(escopo.repos.categorias, { incluirInativas: false }),
    listarAreas(escopo.repos.areas, { incluirInativas: false }),
  ]);

  /**
   * **O vazio grave.** Não existe estado vazio de formulário — mas se `GET /categorias` ou `GET /areas`
   * devolver zero itens ativos, **não há como registrar nada**. A organização nasce com sementes
   * (POL-01), então isso só acontece se o Gestor desativar tudo. Sem esta frase o formulário fica com um
   * campo obrigatório vazio e insubmissível, sem dizer por quê.
   */
  const faltando = [
    categorias.length === 0 ? "categorias" : null,
    areas.length === 0 ? "áreas" : null,
  ].filter((nome): nome is string => nome !== null);

  if (faltando.length > 0) {
    // `escopo.ctx` — `escopo` ja esta estreitado para `"pronto"` pelos dois `if` acima.
    const podeConfigurar = escopo.ctx.vinculo.pode("organizacao.configurar");

    return (
      <MolduraDeTela titulo="Registrar ocorrência">
        <p
          role="alert"
          className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
        >
          Esta organização não tem {faltando.join(" nem ")} ativas.{" "}
          {podeConfigurar
            ? "Reative ao menos uma para voltar a receber ocorrências."
            : "Fale com um Gestor."}
        </p>
        {podeConfigurar && (
          <Link href="/configuracao" className="text-marca text-sm underline underline-offset-4">
            Ir para categorias e áreas
          </Link>
        )}
      </MolduraDeTela>
    );
  }

  return (
    <MolduraDeTela titulo="Registrar ocorrência">
      <FormularioDeOcorrencia
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, icone: c.icone }))}
        areas={areas.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo }))}
      />
    </MolduraDeTela>
  );
}
