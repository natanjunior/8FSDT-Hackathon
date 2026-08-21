import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { acaoDeSair } from "@/interface/acoes";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { resolverParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * **O shell** — e o mapa de navegação da §3 do inventário de telas:
 *
 * | Situação | Destino |
 * |---|---|
 * | sem sessão | **T-01** (`/entrar`), guardando o destino pretendido |
 * | `organizacaoAtiva == null` | **T-02** (`/organizacao`) |
 * | com organização ativa | **T-03** (`/ocorrencias`) — **e T-03 não existe nesta fatia** |
 *
 * A terceira linha é onde esta fatia termina, e vale dizer o que acontece nela em vez de inventar uma tela.
 * O que o shell mostra é o que ele **sempre** mostra: o nome da organização ativa, permanentemente visível.
 * Isso não é enfeite — é *"a única consequência de interface que a fundação técnica nº 38 tem, e ela é
 * necessária: num produto em que a organização vem da sessão e não da URL, o endereço não diz onde você
 * está, então a tela tem de dizer"* (inventário, §3, decisão 3).
 *
 * Ou seja: esta é a tela que responde à segunda metade da fatia — *"vê em qual organização está"*.
 */
export const dynamic = "force-dynamic";

export default async function Shell() {
  let resolucao;
  try {
    resolucao = await resolverParaTela();
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  const contexto = projetarContexto(resolucao);
  const ativa = contexto.organizacaoAtiva;

  if (ativa === null) redirect("/organizacao");

  return (
    <MolduraDeTela titulo={`Olá, ${contexto.pessoa.nome}.`}>
      <section className="border-linha bg-superficie flex flex-col gap-1 rounded-md border px-4 py-3.5">
        <span className="text-tinta-fraca text-xs tracking-wide uppercase">Organização ativa</span>
        <span className="text-tinta text-base leading-snug font-semibold">{ativa.nome}</span>
        <span className="text-tinta-suave text-sm">
          Você é <strong className="text-tinta font-semibold">{rotuloDoPapel(contexto.papel)}</strong> aqui.
        </span>
        <span className="text-tinta-fraca font-mono text-xs">Código: {ativa.codigoPublico}</span>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-tinta text-sm font-semibold">O que você pode fazer aqui</h2>
        {contexto.permissoes.length === 0 ? (
          /* Vínculo `encarregado` recebe `permissoes: []` — declarado, não esquecido (contrato §4.5). */
          <p className="text-tinta-suave text-sm leading-relaxed">
            Nenhuma permissão neste vínculo. Não é engano: as capacidades do Encarregado são evolução
            prevista, e o contrato declara este estado em vez de deixá-lo acontecer por acidente.
          </p>
        ) : (
          <ul className="text-tinta-suave flex flex-col gap-1 font-mono text-xs">
            {contexto.permissoes.map((permissao) => (
              <li key={permissao}>{permissao}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="border-linha bg-superficie text-tinta-suave rounded-md border border-dashed px-3 py-2.5 text-xs leading-relaxed">
        Esta entrega é o <strong className="text-tinta font-semibold">esqueleto de deploy</strong>: a esteira
        inteira, de <code>push</code> a container publicado, com um endpoint —{" "}
        <code>GET /contexto</code> — e as duas telas que ele sustenta. A lista de ocorrências (T-03) e o resto
        do produto vêm nas tarefas seguintes.
      </p>

      <form action={acaoDeSair} className="pt-2">
        <button type="submit" className="text-marca py-1 text-sm underline underline-offset-4">
          Sair
        </button>
      </form>
    </MolduraDeTela>
  );
}

function rotuloDoPapel(papel: string | null): string {
  if (papel === "gestor") return "Gestor";
  if (papel === "encarregado") return "Encarregado";
  if (papel === "solicitante") return "Solicitante";
  return "sem papel";
}
