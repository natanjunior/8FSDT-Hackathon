import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-14 · Áreas** — *"As áreas descrevem este lugar?"*
 *
 * **Esta lista morava em `/configuracao`, junto com a de Categorias, até 16/09/2026.** O argumento da
 * separação está no arquivo pai (`app/(casca)/configuracao/page.tsx`), escrito uma vez.
 *
 * **Alvo primário: tela grande**, pela mesma razão de T-09. **A leitura vai pela estrada direta**
 * (contrato §5), e a lista vem com as inativas, porque é aqui que se reativa o que foi desativado.
 */
export const dynamic = "force-dynamic";

export default async function Areas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") return <SemAcesso />;

  const areas = await listarAreas(escopo.repos.areas, { incluirInativas: true });
  const parametros = await searchParams;
  const ativas = areas.filter((a) => a.ativa).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Áreas</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <FaixaDoDesfecho parametros={parametros} />

      <section className="flex flex-col gap-3">
        <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">
          {ativas} ativas de {areas.length}
        </h2>

        {/* Sempre visível, **nunca num tooltip** — compromisso A-6 do protótipo. */}
        <p className="text-tinta-suave text-sm leading-relaxed">
          Área comum — garagem, hall, salão. Unidade privativa — apartamento, sala, loja.
        </p>

        {/* A mesma frase de T-09, para a outra lista: o inventário escreve `{categoria | área}` nas duas.
            Sem área ativa também não se registra. */}
        {ativas === 0 && (
          <p
            role="alert"
            className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2.5 text-sm font-medium"
          >
            Sem nenhuma área ativa, ninguém consegue registrar ocorrência.
          </p>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-linha text-tinta-fraca border-b text-left text-xs uppercase">
              <th scope="col" className="py-2 pr-3 font-medium">
                Ordem
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Nome
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Tipo
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Situação
              </th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id} className="border-linha-suave border-b">
                <td className="text-tinta-suave py-2.5 pr-3 tabular-nums">{area.ordem}</td>
                <td className="text-tinta py-2.5 pr-3">{area.nome}</td>
                <td className="text-tinta-suave py-2.5 pr-3">{rotuloDoTipo(area.tipo)}</td>
                <td className="text-tinta-suave py-2.5 pr-3">{area.ativa ? "Ativa" : "Inativa"}</td>
                <td className="py-2.5">
                  <Link
                    href={`/configuracao/areas/${area.id}/editar`}
                    className="border-linha text-tinta inline-flex min-h-11 items-center rounded-md border px-3 text-sm"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Link
          href="/configuracao/areas/nova"
          className="border-linha text-tinta inline-flex min-h-11 w-fit items-center rounded-md border px-4 text-sm font-medium"
        >
          Criar área
        </Link>
      </section>

      {/* **Não há apagar, e é a ausência do botão que diz isso** — não uma mensagem depois do clique. */}
      <p className="text-tinta-suave text-sm leading-relaxed">
        Não há como apagar. Desativar tira do formulário de registro e preserva o que já foi registrado.
      </p>

      <Link href="/ocorrencias" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </div>
  );
}

/**
 * **Local, e sem `export`.** Um arquivo `page.tsx` do App Router é um módulo com exportações reservadas —
 * exportar um ajudante daqui é convidar o framework a interpretá-lo.
 */
function rotuloDoTipo(tipo: string): string {
  return tipo === "comum" ? "Área comum" : "Unidade privativa";
}

/**
 * A faixa de desfecho. **Vem da URL e não do estado do componente** porque a escrita recarrega a página.
 *
 * **A frase do tipo é a mais importante desta tela** (`prototipo-low-fi.md`), e tem duas formas — com e
 * sem contagem. Enquanto não houver ocorrências, `mantem` é `0` e a frase sai na forma curta.
 */
function FaixaDoDesfecho({
  parametros,
}: {
  parametros: Record<string, string | string[] | undefined>;
}) {
  const texto = (chave: string) => {
    const valor = parametros[chave];
    return typeof valor === "string" ? valor : "";
  };

  const criada = texto("criada");
  if (criada !== "") {
    return (
      <p
        role="status"
        className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
      >
        A área <strong className="font-semibold">{criada}</strong> foi criada e já aparece no formulário
        de registro.
      </p>
    );
  }

  const alterada = texto("alterada");
  if (alterada === "") return null;

  const tipo = texto("tipo");
  const mantem = Number.parseInt(texto("mantem"), 10);

  return (
    <p
      role="status"
      className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm leading-relaxed"
    >
      <strong className="font-semibold">{alterada}</strong> foi alterada.
      {tipo !== "" && (
        <>
          {" "}
          Passou a ser {rotuloDoTipo(tipo)}.
          {Number.isFinite(mantem) && mantem > 0
            ? ` ${String(mantem)} ocorrências já registradas mantêm o tipo anterior.`
            : ""}{" "}
          Mudar o tipo vale de agora em diante — o passado não muda.
        </>
      )}
    </p>
  );
}

/** O ramo de quem chega por link recebido — o texto é do inventário §7. */
function SemAcesso() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-tinta text-xl font-semibold">Áreas</h1>
      <p role="alert" className="text-tinta-suave text-sm">
        Seu papel nesta organização não dá acesso a esta página.
      </p>
      <Link href="/ocorrencias" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </div>
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
