import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { acaoDeSair } from "@/interface/acoes";
import { MenuDeOrganizacao } from "@/interface/componentes/escolha-de-organizacao";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * ============================================================================
 *  O despachante — e a tela do vínculo sem permissões
 * ============================================================================
 *
 * **Duas coisas, e mais nenhuma.** O `inventario-de-telas.md` (§3) não desenha tela para `/`: o que existe
 * ali é o losango `CTX` (*"tem organização ativa?"*), que desemboca em T-01, T-02, T-10 ou **T-03**. Até o
 * item 14 esta rota acumulava o losango e a moldura de navegação, porque não havia tela de dentro onde
 * pendurar a moldura. Agora há.
 *
 * | Situação | Destino |
 * |---|---|
 * | sem sessão | **T-01** (`/entrar`) |
 * | `organizacaoAtiva == null` | **T-02** (`/organizacao`) |
 * | com `ocorrencia.ler_propria` | **T-03** (`/ocorrencias`) |
 * | `permissoes: []` | **fica aqui** — é a T-10 provisória |
 *
 * **Não há laço:** `/` só redireciona **com** `ocorrencia.ler_propria`, e T-03 só devolve para cá **sem**
 * ela. As condições são complementares porque só existem três papéis: `solicitante` e `gestor` a têm,
 * `encarregado` tem `[]` (`Permissao.ts`).
 *
 * **T-10 não é item do backlog** (`escopo.md` a declara fora da contagem), e esta fatia não a inventa: o
 * que sobrou aqui é a frase que o contrato §4.5 manda existir para o vínculo sem permissão nenhuma.
 */
export const dynamic = "force-dynamic";

export default async function Despachante() {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.ler_propria");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "pronto") redirect("/ocorrencias");

  const contexto = projetarContexto(escopo.resolucao);

  return (
    <MolduraDeTela titulo={`Olá, ${contexto.pessoa.nome}.`}>
      {/* **É o caso que mais importa do item 7b:** o Encarregado com `permissoes: []` em A e Gestor em B
          **não tem outra tela**. Sem o menu aqui, ele fica trancado numa organização em que não pode fazer
          nada, com a outra a um `PUT` de distância e nenhum jeito de chamá-lo. */}
      {contexto.organizacaoAtiva !== null && (
        <section className="border-linha bg-superficie flex flex-col gap-1 rounded-md border px-4 py-3.5">
          <span className="text-tinta-fraca text-xs tracking-wide uppercase">Organização ativa</span>
          <MenuDeOrganizacao
            vinculos={contexto.vinculos}
            organizacaoAtivaId={contexto.organizacaoAtiva.id}
            nomeDaOrganizacaoAtiva={contexto.organizacaoAtiva.nome}
          />
        </section>
      )}

      {/* Vínculo `encarregado` recebe `permissoes: []` — declarado, não esquecido (contrato §4.5). */}
      <p className="text-tinta-suave text-sm leading-relaxed">
        Nenhuma permissão neste vínculo. Não é engano: as capacidades do Encarregado são evolução
        prevista, e o contrato declara este estado em vez de deixá-lo acontecer por acidente.
      </p>

      <form action={acaoDeSair} className="pt-2">
        <button type="submit" className="text-marca py-1 text-sm underline underline-offset-4">
          Sair
        </button>
      </form>
    </MolduraDeTela>
  );
}
