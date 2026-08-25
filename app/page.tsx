import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarPedidosDeEntrada } from "@/aplicacao/organizacao";
import { acaoDeSair } from "@/interface/acoes";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { resolverEscopoParaTela } from "@/interface/http";
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
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("vinculo.gerir");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");

  const contexto = projetarContexto(escopo.resolucao);
  const ativa = contexto.organizacaoAtiva;

  if (ativa === null) redirect("/organizacao");

  /**
   * **A contagem de pedidos pendentes** — Q-T8 do inventário, respondida (a): *"com a notificação ⬜, é a
   * única coisa que separa 'entra hoje' de 'entra quando alguém lembrar'"*.
   *
   * Custa **uma consulta**, não uma requisição: a leitura vai pela estrada direta, e é a mesma consulta
   * que T-08 faz. Só acontece para quem tem `vinculo.gerir`.
   */
  const pendentes =
    escopo.situacao === "pronto"
      ? (await listarPedidosDeEntrada(escopo.repos.pedidosDeEntrada, {})).length
      : null;

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

      {pendentes !== null && (
        <nav className="flex flex-col gap-2">
          <h2 className="text-tinta text-sm font-semibold">Gestão</h2>
          <Link
            href="/vinculos"
            className="border-linha bg-superficie text-tinta flex min-h-11 items-center justify-between rounded-md border px-4 py-3 text-sm"
          >
            <span>Quem está na organização</span>
            {/* A-5: a contagem carrega a palavra, nunca só o número colorido. */}
            <span className="text-tinta-suave text-xs">
              {pendentes === 0
                ? "nenhum pedido aguardando"
                : pendentes === 1
                  ? "1 pedido aguardando"
                  : `${pendentes} pedidos aguardando`}
            </span>
          </Link>

          {/* T-09 só aparece com a permissão que a governa — o inventário §6 pede exatamente isso. */}
          {contexto.permissoes.includes("organizacao.configurar") && (
            <Link
              href="/configuracao"
              className="border-linha bg-superficie text-tinta flex min-h-11 items-center justify-between rounded-md border px-4 py-3 text-sm"
            >
              <span>Categorias e áreas</span>
              <span className="text-tinta-suave text-xs">as opções do formulário de registro</span>
            </Link>
          )}
        </nav>
      )}

      <p className="border-linha bg-superficie text-tinta-suave rounded-md border border-dashed px-3 py-2.5 text-xs leading-relaxed">
        Quem entra, quem cria a organização e quem decide os pedidos já está de pé. O que ainda não existe
        é a <strong className="text-tinta font-semibold">lista de ocorrências</strong> (T-03) — e é ela que
        o produto passa a ter nas tarefas seguintes.
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
