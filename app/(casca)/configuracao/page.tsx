import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, listarCategorias } from "@/aplicacao/organizacao";
import { IconeDeCategoria } from "@/interface/componentes/icone-de-categoria";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-09 · Categorias e áreas** — *"As opções que o Solicitante vê estão certas?"*
 *
 * **Uma tela, não duas.** Categorias e Áreas são as duas listas que **alimentam o mesmo formulário**
 * (T-04) e são o único conteúdo configurável da organização. Separá-las produziria duas telas de uma
 * lista cada.
 *
 * **Alvo primário: tela grande.** É trabalho de escritório, feito sentado, uma vez — o RNF6 cronometra
 * T-04, não esta. No celular as duas listas empilham.
 *
 * **A leitura vai pela estrada direta** (contrato §5): `app/` não pode montar repositório, e um `fetch`
 * interno custaria o salto HTTP que a §5 recusou.
 *
 * **As duas listas vêm com as inativas** — `incluirInativas: true` —, porque é aqui que se reativa o que
 * foi desativado. O padrão *"só as ativas"* é de T-04.
 */
export const dynamic = "force-dynamic";

export default async function CategoriasEAreas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") return <SemAcesso />;

  const [categorias, areas] = await Promise.all([
    listarCategorias(escopo.repos.categorias, { incluirInativas: true }),
    listarAreas(escopo.repos.areas, { incluirInativas: true }),
  ]);

  const parametros = await searchParams;
  const ativas = (itens: readonly { ativa: boolean }[]) => itens.filter((i) => i.ativa).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Categorias e áreas</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <FaixaDoDesfecho parametros={parametros} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="flex flex-col gap-3">
          <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">
            Categorias ({ativas(categorias)} ativas de {categorias.length})
          </h2>

          {/* A frase da semente, sempre visível (spec §2.5) — critério 2.3 do item 2. */}
          <p className="text-tinta-suave text-sm leading-relaxed">
            Sete categorias foram criadas junto com a organização.
          </p>

          {/* **Critério 4a.4, a metade que vive em T-09** — acrescentada na revisão de 24/08/2026.
              A confirmação do formulário avisa **antes** de desativar; esta frase é o **estado**, e é o
              que a tela diz a quem chega depois — inclusive a quem desativou uma a uma, sem nunca ver a
              confirmação da última. O inventário pede as duas leituras: *"ao desativar todas"*. */}
          {ativas(categorias) === 0 && (
            <p
              role="alert"
              className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2.5 text-sm font-medium"
            >
              Sem nenhuma categoria ativa, ninguém consegue registrar ocorrência.
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
                  Situação
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((categoria) => (
                <tr key={categoria.id} className="border-linha-suave border-b">
                  <td className="text-tinta-suave py-2.5 pr-3 tabular-nums">{categoria.ordem}</td>
                  {/* **Critério 4b.4 · o ícone ao lado do nome, nunca no lugar dele.** Não há coluna
                      `Ícone`: uma coluna inteira de desenho seria exatamente o marcador sem palavra que o
                      compromisso A-5 proíbe, com um cabeçalho que não descreve o conteúdo. O desenho vai
                      `aria-hidden` — quem lê por leitor de tela recebe o nome, que é a informação. */}
                  <td className="text-tinta py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <IconeDeCategoria
                        nome={categoria.icone}
                        className="text-tinta-suave size-4 shrink-0"
                      />
                      {categoria.nome}
                    </span>
                  </td>
                  {/* A-5: a situação carrega a palavra, nunca só a cor. */}
                  <td className="text-tinta-suave py-2.5 pr-3">
                    {categoria.ativa ? "Ativa" : "Inativa"}
                  </td>
                  <td className="py-2.5">
                    <Link
                      href={`/configuracao/categorias/${categoria.id}/editar`}
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
            href="/configuracao/categorias/nova"
            className="border-linha text-tinta inline-flex min-h-11 w-fit items-center rounded-md border px-4 text-sm font-medium"
          >
            Criar categoria
          </Link>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">
            Áreas ({ativas(areas)} ativas de {areas.length})
          </h2>

          {/* Sempre visível, **nunca num tooltip** — compromisso A-6 do protótipo. */}
          <p className="text-tinta-suave text-sm leading-relaxed">
            Área comum — garagem, hall, salão. Unidade privativa — apartamento, sala, loja.
          </p>

          {/* A mesma frase, para a outra lista: o inventário escreve `{categoria | área}` nas duas, e o
              4a.4 só nomeia categoria porque é o critério do 4a. Sem área ativa também não se registra. */}
          {ativas(areas) === 0 && (
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
      </div>

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
 * exportar um ajudante daqui é convidar o framework a interpretá-lo. `FaixaDoDesfecho` está no mesmo
 * arquivo e o alcança sem isso.
 */
function rotuloDoTipo(tipo: string): string {
  return tipo === "comum" ? "Área comum" : "Unidade privativa";
}

/**
 * A faixa de desfecho. **Vem da URL e não do estado do componente** porque a escrita recarrega a página:
 * o que aconteceu tem de sobreviver ao recarregamento. Mesma forma de T-08.
 *
 * **A frase do tipo é a mais importante da tela** (`prototipo-low-fi.md`, T-09), e tem duas formas — com e
 * sem contagem. Enquanto a tabela `ocorrencias` não existir, `mantem` é sempre `0` e a frase sai na forma
 * curta (spec §2.1).
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

  const oQue = texto("lista") === "area" ? "área" : "categoria";

  const criada = texto("criada");
  if (criada !== "") {
    return (
      <p
        role="status"
        className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
      >
        A {oQue} <strong className="font-semibold">{criada}</strong> foi criada e já aparece no formulário
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
      <h1 className="text-tinta text-xl font-semibold">Categorias e áreas</h1>
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
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao");
    throw erro;
  }
}
