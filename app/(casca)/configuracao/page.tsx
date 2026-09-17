import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, listarCategorias } from "@/aplicacao/organizacao";
import { CodigoDaOrganizacao } from "@/interface/componentes/codigo-da-organizacao";
import { FormularioDeOrganizacao } from "@/interface/componentes/formulario-de-organizacao";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-15 · Configuração da organização** — *"O que desta organização eu posso ajustar?"*
 *
 * **Duas telas, e antes era uma.** Este arquivo argumentava o contrário, com estas palavras:
 * *"Uma tela, não duas. Categorias e Áreas são as duas listas que alimentam o mesmo formulário"*.
 * O argumento era verdadeiro sobre T-04 e **errado sobre quem configura**: quem está aqui não está
 * registrando ocorrência. Decisão do dono do produto em 15/09/2026, item 48 do backlog. As listas foram
 * para `configuracao/categorias` (T-09) e `configuracao/areas` (T-14), e aqui ficou a configuração da
 * organização.
 *
 * **Ela nasceu sem campo próprio, e ganhou um em 16/09/2026.** O nome editável e o código público da
 * organização eram o item **46 · 47**, e chegaram: a seção *Identidade* abre a tela, com o nome servido
 * por `PATCH /organizacoes` e o código do cartaz do elevador com o gesto de copiar. Até ali esta página
 * era um índice com duas contagens — e a contagem continua aqui, porque responde *"está configurado?"* de
 * um relance, que é a pergunta que a tela fundida respondia ao abrir.
 *
 * **As duas leituras são as mesmas que a tela fundida já disparava em paralelo** — nenhuma consulta nova
 * entrou no produto com a separação. Elas vêm com as inativas porque a contagem diz *"7 ativas de 7"*, e
 * o denominador é o total.
 *
 * **A leitura vai pela estrada direta** (contrato §5): `app/` não pode montar repositório.
 */
export const dynamic = "force-dynamic";

export default async function ConfiguracaoDaOrganizacao({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Configuração" permissao="organizacao.configurar" />;
  }

  const [categorias, areas] = await Promise.all([
    listarCategorias(escopo.repos.categorias, { incluirInativas: true }),
    listarAreas(escopo.repos.areas, { incluirInativas: true }),
  ]);

  const parametros = await searchParams;
  const ativo = escopo.resolucao.ativo;
  const ativas = (itens: readonly { ativa: boolean }[]) => itens.filter((i) => i.ativa).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Configuração</h1>
        {/* **Sem o subtítulo com o nome, e só nesta tela.** Aqui o nome é conteúdo, não contexto: ele
            está no campo abaixo. A `BarraSuperior` continua anunciando a organização ativa. */}
      </header>

      <FaixaDoDesfecho parametros={parametros} />

      {/* **Identidade primeiro, listas depois.** A pergunta da tela é *"o que desta organização eu posso
          ajustar?"*, e o que é **desta** organização vem antes do que está **dentro** dela — a mesma
          regra do geral para o particular que ordena a barra lateral. */}
      <section className="flex flex-col gap-5">
        <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">Identidade</h2>

        {ativo !== null && (
          <>
            <FormularioDeOrganizacao
              nome={ativo.organizacao.nome}
              organizacaoId={ativo.organizacao.id}
            />
            <CodigoDaOrganizacao codigo={ativo.organizacao.codigoPublico} />
          </>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <Destino
          href="/configuracao/categorias"
          titulo="Categorias"
          contagem={`${ativas(categorias)} ativas de ${categorias.length}`}
          descricao="A natureza da ocorrência — o que o Solicitante escolhe ao registrar."
        />
        <Destino
          href="/configuracao/areas"
          titulo="Áreas"
          contagem={`${ativas(areas)} ativas de ${areas.length}`}
          descricao="Onde dentro desta organização a ocorrência aconteceu."
        />
      </div>

      {/* **Não há apagar, e é a ausência do botão que diz isso.** A frase fica aqui além de ficar nas
          duas listas: quem chega pelo menu vê o regime antes de abrir qualquer uma delas. */}
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
 * **O desfecho sobrevive ao recarregamento porque vem na URL**, e não num estado que o `router.refresh()`
 * apagaria. Mesma forma de T-09, T-14 e T-08.
 */
function FaixaDoDesfecho({
  parametros,
}: {
  parametros: Record<string, string | string[] | undefined>;
}) {
  const valor = parametros["renomeada"];
  const renomeada = typeof valor === "string" ? valor : "";
  if (renomeada === "") return null;

  return (
    <p
      role="status"
      className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
    >
      A organização passou a se chamar <strong className="font-semibold">{renomeada}</strong>.
    </p>
  );
}

/**
 * Um destino do índice.
 *
 * **A contagem carrega a palavra, nunca só o número** (compromisso A-5): *"7 ativas de 7"*, e nunca um
 * selo numérico ao lado do título.
 *
 * **A seta vai `aria-hidden`** — é o mesmo desenho que o rótulo já diz, e quem lê por leitor de tela
 * recebe o título do link, que é a informação.
 */
function Destino({
  href,
  titulo,
  contagem,
  descricao,
}: {
  href: string;
  titulo: string;
  contagem: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="border-linha bg-superficie flex min-h-11 items-center justify-between gap-4 rounded-md border px-4 py-3"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-tinta text-sm font-semibold">
          {titulo} · {contagem}
        </span>
        <span className="text-tinta-suave text-sm leading-relaxed">{descricao}</span>
      </span>
      <span aria-hidden="true" className="text-tinta-fraca shrink-0 text-sm">
        →
      </span>
    </Link>
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
