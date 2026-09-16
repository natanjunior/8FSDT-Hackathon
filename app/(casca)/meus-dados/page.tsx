import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { FormularioDePessoa } from "@/interface/componentes/formulario-de-pessoa";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-16 · Meus dados** — *"o que é meu, e como eu entro?"*
 *
 * **Não é subrota de `/configuracao`**: configuração é **da organização**, e o item 48 separou os dois
 * assuntos justamente porque quem administra a organização não está administrando a si mesmo. Dado
 * pessoal é global, e por isso também não tem lugar na barra lateral, cujo `aria-label` é *"Nesta
 * organização"*. **O caminho é o menu do avatar**, onde o nome já era impresso como item desabilitado.
 *
 * **Nenhuma requisição nova na abertura, e é a única tela do produto assim:** o nome e o e-mail vêm da
 * resolução de contexto que a casca já fez.
 *
 * **Quem não tem vínculo nenhum não chega aqui**, porque a casca exige `qualquer-vinculo-ativo` e T-02
 * não tem barra superior. Para essa pessoa o ponto de correção continua sendo o campo `nome` de
 * `POST /pedidos-de-entrada`, pré-preenchido. É a mesma assimetria que a §4.4 do contrato já declara
 * para `POST /organizacoes`: contrato aberto, tela fechada.
 */
export const dynamic = "force-dynamic";

export default async function MeusDados({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  // `qualquer-vinculo-ativo` nunca produz `sem-permissao`; a guarda existe para o tipo, não para o caso.
  if (escopo.situacao === "sem-permissao") redirect("/ocorrencias");

  const parametros = await searchParams;
  const { nome, email } = escopo.resolucao.sessao;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Meus dados</h1>
      </header>

      <FaixaDoDesfecho parametros={parametros} />

      {/* **Identidade antes de mecanismo** — a mesma regra do geral para o particular que ordena a barra
          lateral e que T-15 usou: o que é seu vem antes de como você entra. */}
      <section className="flex flex-col gap-5">
        <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">Identidade</h2>
        <FormularioDePessoa nome={nome} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">Acesso</h2>

        <div className="flex flex-col gap-1.5">
          <p className="text-tinta text-sm font-medium">E-mail de entrada</p>
          <p className="text-tinta text-sm break-all">{email ?? "Não informado pelo provedor"}</p>
          <p className="text-tinta-suave text-xs leading-relaxed">
            É com ele que você entra, e é para ele que vai o link de recuperação de senha. Nesta entrega
            ele não muda.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-tinta text-sm font-medium">Senha</p>
          {/* **Aponta, em vez de duplicar.** T-12 aceita quem tem sessão desde a D-6b-5, e é a única
              porta de trocar a senha que o produto tem. */}
          <Link
            href="/redefinir-senha"
            className="text-marca inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Redefinir senha
          </Link>
        </div>

        {/* **A frase honesta, e ela é o achado A-02 virando linha na tela.** O
            `409 PESSOA_COM_CONTA_NAO_EDITAVEL` recusa o Gestor, e esta entrega recusa a própria pessoa:
            dizer "peça a um Gestor" seria meia verdade, que é pior que nenhuma. */}
        <p className="text-tinta-suave text-sm leading-relaxed">
          Nesta entrega os seus telefones e e-mails de contato não são editáveis, nem por você nem pelo
          Gestor.
        </p>
      </section>

      <Link href="/ocorrencias" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </div>
  );
}

/**
 * **O desfecho sobrevive ao recarregamento porque vem na URL**, e não num estado que o `router.refresh()`
 * apagaria. Mesma forma de T-15, T-09, T-14 e T-08.
 */
function FaixaDoDesfecho({
  parametros,
}: {
  parametros: Record<string, string | string[] | undefined>;
}) {
  const valor = parametros["renomeado"];
  const renomeado = typeof valor === "string" ? valor : "";
  if (renomeado === "") return null;

  return (
    <p
      role="status"
      className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
    >
      Você passou a aparecer como <strong className="font-semibold">{renomeado}</strong> em todas as suas
      organizações.
    </p>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("qualquer-vinculo-ativo");
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fmeus-dados");
    throw erro;
  }
}
