import { ChevronRight, LayoutGrid, Tags, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  contarAreas,
  contarCategorias,
  lerConfiguracao,
  listarEtiquetas,
  listarVinculos,
} from "@/aplicacao/organizacao";
import { type AbaDaConfiguracao, lerAba } from "@/interface/componentes/aba-da-configuracao";
import { AbasDaConfiguracao } from "@/interface/componentes/abas-da-configuracao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import { CodigoDaOrganizacao } from "@/interface/componentes/codigo-da-organizacao";
import { ConviteDaOrganizacao } from "@/interface/componentes/convite-da-organizacao";
import { dataEHora } from "@/interface/componentes/datas";
import { EdicaoDasRegras } from "@/interface/componentes/edicao-das-regras";
import { EdicaoDeNome } from "@/interface/componentes/edicao-de-nome";
import { EdicaoDosRotulos } from "@/interface/componentes/edicao-dos-rotulos";
import { EtiquetasDaOrganizacao } from "@/interface/componentes/etiquetas-da-organizacao";
import { usoPorEtiqueta } from "@/interface/componentes/etiquetas-de-participante";
import {
  APOIO_DO_CARTAO_DE_REGRAS,
  APOIO_DO_LIMITE,
  APOIO_DOS_DIAS,
  ROTULO_DA_REGRA,
  SEM_MUDANCAS,
  TITULO_DAS_MUDANCAS,
  TITULO_DAS_REGRAS,
  fraseDaMudanca,
  valorEmPalavra,
} from "@/interface/componentes/regras-da-configuracao";
import { EDICAO_DE_NOME } from "@/interface/componentes/regras-do-nome";
import {
  APOIO_DO_CARTAO_DE_ROTULOS,
  ESTADOS_DO_CICLO,
  MARCA_DO_PADRAO,
  NOME_DO_CICLO,
  TITULO_DOS_ROTULOS,
  type EstadoDaTela,
} from "@/interface/componentes/rotulos-do-solicitante";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { montarLinkDoConvite, resolverEscopoParaTela } from "@/interface/http";
import {
  projetarConfiguracao,
  projetarEtiqueta,
  projetarVinculo,
  rotuloPadraoDoSolicitante,
} from "@/interface/projecoes";

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
 * **As duas leituras são contagens** (item 106, critério 3): a tela imprime quatro números, e trazer cada
 * linha para contá-la no servidor da aplicação era o custo sem motivo. O denominador continua sendo o
 * total, ativas e inativas. O nome e o código vêm do contexto que a página já resolveu. O desfecho do
 * salvamento é um aviso, que mora no layout raiz.
 *
 * **A identidade fica fixa, e o resto vai em três abas** (item 120, ordem do dono em 03/10/2026):
 * *Configurações de ocorrências* (regras, textos e as listas do formulário), *Configurações de
 * participantes* (etiquetas e convite) e *Histórico* (as mudanças). A primeira vem selecionada, e o
 * endereço diz qual está aberta (`aba-da-configuracao.ts`).
 *
 * **A leitura vai pela estrada direta** (contrato §5): `app/` não pode montar repositório.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configuração da organização" };

/** O rótulo de um item da lista de definição: o papel de rótulo de coluna do guia §3. */
const ROTULO = "text-rotulo-coluna text-tinta-suave font-mono uppercase";

/**
 * **Os textos padrão descem prontos do servidor** (item 100). O navegador não monta rótulo, e é a mesma
 * regra que faz os dois mapas de `rotulos.ts` descerem prontos para T-05.
 */
const PADROES_DO_SOLICITANTE = Object.fromEntries(
  ESTADOS_DO_CICLO.map((estado) => [estado, rotuloPadraoDoSolicitante(estado)]),
) as Record<EstadoDaTela, string>;

/**
 * O contrato traz os seis com `null` onde vale o padrão; o modal quer **só o customizado**, porque nele a
 * ausência é o que distingue *"em branco"* de *"escrito"*.
 */
function rotulosCustomizados(
  dosSeis: Readonly<Record<EstadoDaTela, string | null>>,
): Readonly<Partial<Record<EstadoDaTela, string>>> {
  return Object.fromEntries(
    Object.entries(dosSeis).filter(([, texto]) => texto !== null),
  ) as Readonly<Partial<Record<EstadoDaTela, string>>>;
}

export default async function ConfiguracaoDaOrganizacao({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const escopo = await resolverOuMandarParaPorta();

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Configuração da organização" permissao="organizacao.configurar" />;
  }

  // **A aba de participantes responde por `vinculo.gerir`**, e cada cartão dela também (item 120, bloco 5).
  // Hoje as duas permissões andam juntas no Gestor (`Permissao.ts:58-59`); a regra existe para o dia em que
  // os papéis se separarem.
  const geriVinculos = escopo.ctx.vinculo.pode("vinculo.gerir");
  const disponiveis: readonly AbaDaConfiguracao[] = geriVinculos
    ? ["ocorrencias", "participantes", "historico"]
    : ["ocorrencias", "historico"];
  const inicial = lerAba((await searchParams)["aba"], disponiveis);

  // **A leitura do cartão também é guardada** (critério 20): sem `vinculo.gerir`, nem etiqueta nem vínculo
  // saem do banco nesta página. A contagem e a confirmação usam o MESMO `uso` (critério 18).
  const [categorias, areas, configuracao, etiquetasLidas, vinculosLidos] = await Promise.all([
    contarCategorias(escopo.repos.categorias),
    contarAreas(escopo.repos.areas),
    lerConfiguracao(escopo.repos.configuracao).then(projetarConfiguracao),
    geriVinculos ? listarEtiquetas(escopo.repos.etiquetas) : Promise.resolve([]),
    geriVinculos ? listarVinculos(escopo.repos.vinculos) : Promise.resolve([]),
  ]);
  const etiquetas = etiquetasLidas.map(projetarEtiqueta);
  const uso = usoPorEtiqueta(vinculosLidos.map(projetarVinculo));

  const ativo = escopo.resolucao.ativo;
  // O link do convite só se monta para quem vê o cartão.
  const link = geriVinculos && ativo !== null ? await montarLinkDoConvite(ativo.organizacao.codigoPublico) : null;

  return (
    <div className="flex flex-col gap-5.5">
      {/* **O título diz de quem é a configuração** (critério 44i.1); a barra lateral continua dizendo
          *Configuração*, porque o item está sob o grupo Organização. O ramo sem acesso passa o mesmo
          título, e o `loading.tsx` também. */}
      <CabecalhoDaPagina
        titulo="Configuração da organização"
        fato="A identidade desta organização, e o que se ajusta nas ocorrências e nos participantes, com o histórico das mudanças."
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

      <AbasDaConfiguracao
        inicial={inicial}
        disponiveis={disponiveis}
        conteudo={{
          ocorrencias: (
            <>
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
                          diasParaParada: configuracao.diasParaParada,
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
                    {/* **A terceira regra** (item 101): quantos dias sem atividade até a ocorrência contar como
                        parada. O valor vai em palavra, com a unidade. */}
                    <div className="border-linha-suave flex flex-col gap-2 border-t p-[15px] md:px-6 md:py-5">
                      <dt className={ROTULO}>{ROTULO_DA_REGRA.dias_para_parada}</dt>
                      <dd className="text-titulo-bloco text-tinta font-medium">
                        {valorEmPalavra("dias_para_parada", String(configuracao.diasParaParada))}
                      </dd>
                      <dd className="text-meta text-tinta-suave max-w-110">{APOIO_DOS_DIAS}</dd>
                    </div>
                  </dl>
                </Cartao>
              )}

              {/* **Como ela fala, depois de como ela trabalha** (item 100): o texto de cada ponto do ciclo é
                  apresentação, e o nome interno não muda — é a D19. Em pilha no celular, duas colunas na tela
                  grande, como a identidade. */}
              {ativo !== null && (
                <Cartao tituloId="rotulos">
                  <CabecaDoCartao
                    id="rotulos"
                    titulo={TITULO_DOS_ROTULOS}
                    apoio={APOIO_DO_CARTAO_DE_ROTULOS}
                    acao={
                      <EdicaoDosRotulos
                        rotulos={rotulosCustomizados(configuracao.rotulosDoSolicitante)}
                        padroes={PADROES_DO_SOLICITANTE}
                        organizacaoId={ativo.organizacao.id}
                      />
                    }
                  />
                  <dl className="grid lg:grid-cols-2">
                    {ESTADOS_DO_CICLO.map((estado, indice) => {
                      const customizado = configuracao.rotulosDoSolicitante[estado];
                      return (
                        <div
                          key={estado}
                          /* **`min-w-0`, e é o que faz o critério 5 fechar em 360 px.** Item de grade nasce
                             com `min-width: auto`, e um texto de quarenta caracteres sem espaço vira a largura
                             mínima da coluna — a grade cresce e a página rola de lado. Com ele, o
                             `wrap-break-word` do `<dd>` tem onde quebrar. */
                          className={`border-linha-suave flex min-w-0 flex-col gap-2 p-[15px] md:px-6 md:py-5 ${
                            indice === 0 ? "" : "border-t"
                          } ${indice < 2 ? "lg:border-t-0" : ""} ${indice % 2 === 1 ? "lg:border-l" : ""}`}
                        >
                          <dt className={ROTULO}>{NOME_DO_CICLO[estado]}</dt>
                          <dd className="text-titulo-bloco text-tinta font-medium wrap-break-word">
                            {customizado ?? PADROES_DO_SOLICITANTE[estado]}
                          </dd>
                          {customizado === null && (
                            <dd className="text-meta text-tinta-suave">{MARCA_DO_PADRAO}</dd>
                          )}
                        </div>
                      );
                    })}
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
                      ativas={categorias.ativas}
                      total={categorias.total}
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
                      ativas={areas.ativas}
                      total={areas.total}
                    />
                  </li>
                </ul>
              </Cartao>
            </>
          ),
          participantes: geriVinculos ? (
            <>
              <EtiquetasDaOrganizacao
                etiquetas={etiquetas}
                uso={uso}
                organizacaoId={escopo.ctx.vinculo.organizacaoId}
              />
              {ativo !== null && link !== null && (
                <ConviteDaOrganizacao
                  organizacao={{ nome: ativo.organizacao.nome, codigoPublico: ativo.organizacao.codigoPublico }}
                  link={link}
                />
              )}
            </>
          ) : null,
          historico: (
            <>
              {/* **A história por último** (item 99). Cada mudança é uma pilha de duas linhas, e não uma tabela:
                  é o que a mantém legível em 360 px sem rolagem lateral (critério 99.8). */}
              <Cartao tituloId="mudancas">
                <CabecaDoCartao
                  id="mudancas"
                  titulo={TITULO_DAS_MUDANCAS}
                  apoio="Quem mudou o quê, quando, e de que valor para qual."
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
            </>
          ),
        }}
      />
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
