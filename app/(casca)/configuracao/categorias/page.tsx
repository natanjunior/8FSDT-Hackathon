import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarCategorias } from "@/aplicacao/organizacao";
import { IconeDeCategoria } from "@/interface/componentes/icone-de-categoria";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";

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
 * desativado. O padrão *"só as ativas"* é de T-04.
 */
export const dynamic = "force-dynamic";

export default async function Categorias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Categorias" permissao="organizacao.configurar" />;
  }

  const categorias = await listarCategorias(escopo.repos.categorias, { incluirInativas: true });
  const parametros = await searchParams;
  const ativas = categorias.filter((c) => c.ativa).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Categorias</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <FaixaDoDesfecho parametros={parametros} />

      <section className="flex flex-col gap-3">
        <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">
          {ativas} ativas de {categorias.length}
        </h2>

        {/* A frase da semente, sempre visível (spec §2.5) — critério 2.3 do item 2. */}
        <p className="text-tinta-suave text-sm leading-relaxed">
          Sete categorias foram criadas junto com a organização.
        </p>

        {/* **Critério 4a.4, a metade que vive nesta tela** — acrescentada na revisão de 24/08/2026.
            A confirmação do formulário avisa **antes** de desativar; esta frase é o **estado**, e é o
            que a tela diz a quem chega depois — inclusive a quem desativou uma a uma, sem nunca ver a
            confirmação da última. O inventário pede as duas leituras: *"ao desativar todas"*. */}
        {ativas === 0 && (
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

      {/* **Não há apagar, e é a ausência do botão que diz isso** — não uma mensagem depois do clique. */}
      <p className="text-tinta-suave text-sm leading-relaxed">
        Não há como apagar. Desativar tira do formulário de registro e preserva o que já foi registrado.
      </p>

      {/* **Volta para T-03, e não para a Configuração.** A regra é do inventário — *"T-03 é o eixo: toda
          tela de dentro se alcança dela"* —, e uma segunda hierarquia de retorno economizaria um clique
          que a barra lateral já dá. As subrotas de criar e editar é que voltam para cá. */}
      <Link href="/ocorrencias" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </div>
  );
}

/**
 * A faixa de desfecho. **Vem da URL e não do estado do componente** porque a escrita recarrega a página:
 * o que aconteceu tem de sobreviver ao recarregamento. Mesma forma de T-08.
 *
 * **O parâmetro `lista=` morreu com a separação:** com uma tela por lista, o endereço já diz qual é.
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
        A categoria <strong className="font-semibold">{criada}</strong> foi criada e já aparece no
        formulário de registro.
      </p>
    );
  }

  const alterada = texto("alterada");
  if (alterada === "") return null;

  return (
    <p
      role="status"
      className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
    >
      <strong className="font-semibold">{alterada}</strong> foi alterada.
    </p>
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
