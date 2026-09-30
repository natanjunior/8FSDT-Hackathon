import { ChevronRight, LayoutGrid, Tags, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { lerConfiguracao, listarAreas, listarCategorias } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import { CodigoDaOrganizacao } from "@/interface/componentes/codigo-da-organizacao";
import { dataEHora } from "@/interface/componentes/datas";
import { EdicaoDasRegras } from "@/interface/componentes/edicao-das-regras";
import { EdicaoDeNome } from "@/interface/componentes/edicao-de-nome";
import {
  APOIO_DO_CARTAO_DE_REGRAS,
  APOIO_DO_LIMITE,
  ROTULO_DA_REGRA,
  SEM_MUDANCAS,
  TITULO_DAS_MUDANCAS,
  TITULO_DAS_REGRAS,
  fraseDaMudanca,
  valorEmPalavra,
} from "@/interface/componentes/regras-da-configuracao";
import { EDICAO_DE_NOME } from "@/interface/componentes/regras-do-nome";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarConfiguracao } from "@/interface/projecoes";

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
 * **O cartão mostra, o modal edita** (item 44i, guia §7). A identidade é leitura num cartão, e *Editar*
 * abre o modal do nome, que só edita. O código fica fora do modal, porque não se edita, em dois grupos de
 * quatro. As duas listas são uma pauta de índice num cartão, com o mesmo fundo nas duas linhas: cartão de
 * índice com poucas linhas não alterna fundo.
 *
 * **A contagem continua**, porque responde *"está configurado?"* de um relance, que é a pergunta que a
 * tela fundida respondia ao abrir. Ela carrega a palavra, nunca só o número (compromisso A-5).
 *
 * **As duas leituras são as mesmas que a tela fundida já disparava em paralelo**, e vêm com as inativas
 * porque o denominador da contagem é o total. O nome e o código vêm do contexto que a página já
 * resolveu. O desfecho do salvamento é um aviso, que mora no layout raiz.
 *
 * **Três cartões e uma pauta desde o item 99:** as regras moram entre a identidade e as listas porque
 * dizem como a organização trabalha; as mudanças vão por último porque são história.
 *
 * **A leitura vai pela estrada direta** (contrato §5): `app/` não pode montar repositório.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configuração da organização" };

/** O rótulo de um item da lista de definição: o papel de rótulo de coluna do guia §3. */
const ROTULO = "text-rotulo-coluna text-tinta-suave font-mono uppercase";

export default async function ConfiguracaoDaOrganizacao() {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Configuração da organização" permissao="organizacao.configurar" />;
  }

  const [categorias, areas, configuracao] = await Promise.all([
    listarCategorias(escopo.repos.categorias, { incluirInativas: true }),
    listarAreas(escopo.repos.areas, { incluirInativas: true }),
    lerConfiguracao(escopo.repos.configuracao).then(projetarConfiguracao),
  ]);

  const ativo = escopo.resolucao.ativo;
  const ativas = (itens: readonly { ativa: boolean }[]) => itens.filter((i) => i.ativa).length;

  return (
    <div className="flex flex-col gap-5.5">
      {/* **O título diz de quem é a configuração** (critério 44i.1); a barra lateral continua dizendo
          *Configuração*, porque o item está sob o grupo Organização. O ramo sem acesso passa o mesmo
          título, e o `loading.tsx` também. */}
      <CabecalhoDaPagina
        titulo="Configuração da organização"
        fato="A identidade desta organização, as regras do atendimento e as duas listas do formulário de registro."
      />

      {/* **Identidade primeiro, listas depois.** A pergunta da tela é *"o que desta organização eu posso
          ajustar?"*, e o que é **desta** organização vem antes do que está **dentro** dela, a mesma
          regra do geral para o particular que ordena a barra lateral. */}
      {ativo !== null && (
        <Cartao tituloId="identidade">
          <CabecaDoCartao
            id="identidade"
            titulo="Identidade"
            apoio="O que identifica a organização para quem está fora dela."
            acao={
              <EdicaoDeNome
                alvo="organizacao"
                nome={ativo.organizacao.nome}
                organizacaoId={ativo.organizacao.id}
              />
            }
          />
          <dl className="grid lg:grid-cols-2">
            <div className="flex flex-col gap-2 p-[15px] md:px-6 md:py-5">
              <dt className={ROTULO}>Nome</dt>
              <dd className="text-titulo-bloco text-tinta font-medium wrap-break-word">
                {ativo.organizacao.nome}
              </dd>
              <dd className="text-meta text-tinta-suave max-w-110">{EDICAO_DE_NOME.organizacao.ajuda}</dd>
            </div>
            <div className="border-linha-suave flex flex-col gap-2.5 border-t p-[15px] md:px-6 md:py-5 lg:border-t-0 lg:border-l">
              <dt className={ROTULO}>Código da organização</dt>
              <CodigoDaOrganizacao codigo={ativo.organizacao.codigoPublico} />
            </div>
          </dl>
        </Cartao>
      )}

      {/* **As regras entre a identidade e as listas** (item 99): quem a organização é, como ela
          trabalha, e o que ela oferece no formulário — do geral para o particular. */}
      {ativo !== null && (
        <Cartao tituloId="regras">
          <CabecaDoCartao
            id="regras"
            titulo={TITULO_DAS_REGRAS}
            apoio={APOIO_DO_CARTAO_DE_REGRAS}
            acao={
              <EdicaoDasRegras
                regras={{
                  exigirSolucaoAoResolver: configuracao.exigirSolucaoAoResolver,
                  limiteDeCancelamentoDoSolicitante: configuracao.limiteDeCancelamentoDoSolicitante,
                }}
                organizacaoId={ativo.organizacao.id}
              />
            }
          />
          <dl className="grid lg:grid-cols-2">
            <div className="flex flex-col gap-2 p-[15px] md:px-6 md:py-5">
              <dt className={ROTULO}>{ROTULO_DA_REGRA.exigir_solucao_ao_resolver}</dt>
              <dd className="text-titulo-bloco text-tinta font-medium">
                {valorEmPalavra(
                  "exigir_solucao_ao_resolver",
                  String(configuracao.exigirSolucaoAoResolver),
                )}
              </dd>
            </div>
            <div className="border-linha-suave flex flex-col gap-2 border-t p-[15px] md:px-6 md:py-5 lg:border-t-0 lg:border-l">
              <dt className={ROTULO}>{ROTULO_DA_REGRA.limite_cancelamento_solicitante}</dt>
              <dd className="text-titulo-bloco text-tinta font-medium">
                {valorEmPalavra(
                  "limite_cancelamento_solicitante",
                  configuracao.limiteDeCancelamentoDoSolicitante,
                )}
              </dd>
              <dd className="text-meta text-tinta-suave max-w-110">{APOIO_DO_LIMITE}</dd>
            </div>
          </dl>
        </Cartao>
      )}

      <Cartao tituloId="listas">
        <CabecaDoCartao
          id="listas"
          titulo="Listas do formulário de registro"
          apoio="O que o Solicitante escolhe quando registra uma ocorrência."
        />
        <ul>
          <li className="border-linha-suave border-b">
            <DestinoDaPauta
              href="/configuracao/categorias"
              Icone={Tags}
              titulo="Categorias"
              descricao="A natureza da ocorrência."
              ativas={ativas(categorias)}
              total={categorias.length}
            />
          </li>
          <li>
            {/* **"desta organização", e não o lugar do exemplo** (A-02 da spec): a organização pode ser
                condomínio, empresa ou bairro. */}
            <DestinoDaPauta
              href="/configuracao/areas"
              Icone={LayoutGrid}
              titulo="Áreas"
              descricao="Onde, dentro desta organização, ela aconteceu."
              ativas={ativas(areas)}
              total={areas.length}
            />
          </li>
        </ul>
      </Cartao>
      {/* **A história por último** (item 99). Cada mudança é uma pilha de duas linhas, e não uma tabela:
          é o que a mantém legível em 360 px sem rolagem lateral (critério 99.8). */}
      <Cartao tituloId="mudancas">
        <CabecaDoCartao
          id="mudancas"
          titulo={TITULO_DAS_MUDANCAS}
          apoio="Quem mudou uma regra, quando, e de que valor para qual."
        />
        {configuracao.mudancas.length === 0 ? (
          <p className="text-interface text-tinta-suave p-[15px] md:px-6 md:py-5">{SEM_MUDANCAS}</p>
        ) : (
          <ul>
            {configuracao.mudancas.map((mudanca) => (
              <li
                key={`${mudanca.chave}-${mudanca.ocorridaEm}`}
                className="border-linha-suave flex flex-col gap-1 border-b p-[15px] last:border-b-0 md:px-6 md:py-5"
              >
                <span className="text-meta text-tinta-suave wrap-break-word">
                  {mudanca.autor.nome} · {dataEHora(mudanca.ocorridaEm)}
                </span>
                <span className="text-interface text-tinta wrap-break-word">
                  {fraseDaMudanca(mudanca)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

    </div>
  );
}

/**
 * Uma linha da pauta de índice.
 *
 * **A contagem carrega a palavra, nunca só o número** (compromisso A-5): *"7 ativas de 8"*. Os dois
 * números vão em mono tabular, o primeiro em tinta, e no celular a contagem desce para baixo da
 * descrição.
 *
 * **O ladrilho e a seta vão `aria-hidden`**: quem lê por leitor de tela recebe o nome, a descrição e a
 * contagem, que são a informação. Os ícones são os da barra lateral, para o mesmo destino ter o mesmo
 * desenho nos dois lugares.
 */
function DestinoDaPauta({
  href,
  Icone,
  titulo,
  descricao,
  ativas,
  total,
}: {
  href: string;
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
  ativas: number;
  total: number;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-muted/60 flex min-h-11 items-center gap-3.5 px-[15px] py-3.5 transition-colors md:px-[18px]"
    >
      <span
        aria-hidden="true"
        className="border-linha bg-background text-tinta-suave flex size-9 shrink-0 items-center justify-center rounded-md border"
      >
        <Icone className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-titulo-linha text-tinta">{titulo}</span>
          <span className="text-meta text-tinta-suave">{descricao}</span>
        </span>
        <span className="text-interface text-tinta-suave shrink-0">
          <span className="text-tinta font-mono tabular-nums">{ativas}</span> ativas de{" "}
          <span className="font-mono tabular-nums">{total}</span>
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="text-tinta-suave size-4 shrink-0" />
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
