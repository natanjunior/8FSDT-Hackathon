import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { acaoDeSair } from "@/interface/acoes";
import { FormularioDeNovaOrganizacao } from "@/interface/componentes/formulario-de-nova-organizacao";
import { FormularioDePedidoDeEntrada } from "@/interface/componentes/formulario-de-pedido-de-entrada";
import { EscolhaDeOrganizacao } from "@/interface/componentes/menu-de-organizacao";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { resolverParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * **T-02 · Sem organização ativa** — *"Onde eu trabalho?"*
 *
 * Uma tela, **cinco faces**, e a face é escolhida por `GET /contexto` — o único endpoint que uma Pessoa
 * sem vínculo consegue usar (contrato §8.0). Aqui a leitura vai pela **estrada direta** da §5, com a mesma
 * projeção do route handler.
 *
 * **As quatro primeiras são para quem não tem organização ativa.** A face **C** (pedido recusado) passou a
 * ser alcançável com o item 8, que é quem produz `situacao: "recusado"` — até ele, ela era inalcançável
 * por construção.
 *
 * **A quinta é a face E, e é o avesso das outras: ela só existe COM organização ativa** (item 7b). É
 * desenho novo, autorizado pelo critério 7b.5 — *"a forma desse ponto não está escrita em documento
 * nenhum"* —, e o que ela entrega é o caminho que faltava para a Persona 1B: pedir entrada em outra
 * organização **sem sair da que se está**.
 *
 * **Desde o item 7b nenhum botão desta tela diz na tela que não faz.** A face D passou a chamar o
 * `PUT /contexto/organizacao`, e com ela saiu o **último `AvisoDeFatia` do produto**.
 */
export const dynamic = "force-dynamic";

export default async function TelaSemOrganizacaoAtiva({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolucao = await resolverOuMandarParaPorta();
  const contexto = projetarContexto(resolucao);
  const parametros = await searchParams;

  /**
   * **A doutrina do `lerBooleanoDaUrl`** (`consulta-de-url.ts:25-34`): valor diferente de `"true"` é
   * tratado como **ausente**, não como verdadeiro. A diferença declarada é que uma **página** não tem
   * como devolver `400` — então o que sobra é ignorar, e o ignorar tem de ser o caso seguro.
   */
  const querEntrarEmOutra = parametros["entrar-em-outra"] === "true";

  // Quem tem organização ativa não pertence a esta tela — **exceto** para pedir entrada em outra sem
  // sair desta, que é a face E e é o item 7b inteiro.
  if (contexto.organizacaoAtiva !== null) {
    if (querEntrarEmOutra) {
      return (
        <FaceE
          organizacaoAtiva={contexto.organizacaoAtiva}
          vinculos={contexto.vinculos}
          pedidos={contexto.pedidosDeEntrada}
        />
      );
    }
    redirect("/");
  }

  // **Pendente ganha de tudo — para quem não tem vínculo nenhum.** Quem tem pedido em andamento não deve
  // ser convidado a abrir outro, e é por isso que a face B não tem campo de código.
  //
  // **A condição `vinculos.length === 0` é o critério 7b.7**, e a face C já a tinha (`:42`). Sem ela, quem
  // tem **dois vínculos, nenhum ativo e um pedido pendente** cai aqui e só recebe *"Sair"* — trancado fora
  // das duas organizações em que já foi aceito. É alcançável desde o item 7b, porque é ele que produz o
  // segundo vínculo e o pedido feito de dentro; `escolherAtivo` devolve `null` com dois ou mais vínculos
  // sem cookie válido (`resolver-contexto.ts:170-177`), que é celular novo, aba anônima ou cookie expirado.
  const pendente = contexto.pedidosDeEntrada.find((pedido) => pedido.situacao === "pendente");
  if (pendente !== undefined && contexto.vinculos.length === 0) return <FaceB pedido={pendente} />;

  // **Face C — recusado.** A lista vem em `criadoEm` decrescente (spec §2.6 do 7a), então o primeiro
  // recusado é o mais recente. Só aparece para quem não tem vínculo nenhum: quem foi recusado em B e
  // entrou em A tem organização ativa e nem chega aqui.
  const recusado = contexto.pedidosDeEntrada.find((pedido) => pedido.situacao === "recusado");
  if (recusado !== undefined && contexto.vinculos.length === 0) {
    return <FaceC nome={contexto.pessoa.nome} organizacao={recusado.organizacao.nome} />;
  }

  if (contexto.vinculos.length >= 2) {
    return <FaceD vinculos={contexto.vinculos} pendente={pendente ?? null} />;
  }
  return <FaceA nome={contexto.pessoa.nome} />;
}

/**
 * **Face A · Entrar em uma organização.** `vinculos: []` e `pedidosDeEntrada: []` — acabou de criar a conta.
 *
 * **É o estado vazio, e por isso é convite e não aviso.** Dois caminhos, com hierarquia clara: quem chega
 * aqui quase sempre está **entrando**, não fundando — e desde esta linha os dois funcionam.
 */
function FaceA({ nome }: { nome: string }) {
  return (
    <MolduraDeTela titulo="Você ainda não está em nenhuma organização.">
      <FormularioDePedidoDeEntrada nome={nome} />

      <hr className="border-linha-suave my-1" />

      <p className="text-tinta-suave text-sm leading-relaxed">
        Você administra um condomínio, empresa ou bairro que ainda não usa o Resolve Aí?
      </p>
      {/* Do item 1 — não trocar por botão desabilitado. */}
      <FormularioDeNovaOrganizacao />

      <BotaoDeSair />
    </MolduraDeTela>
  );
}

/**
 * **Face B · Esperando aprovação.** `vinculos: []` e um pedido `pendente`.
 *
 * **A segunda frase não é enfeite.** O aviso automático de aprovação é ⬜ (Q10), e uma tela que diz
 * *"aguarde"* sem dizer *"e nada vai te chamar"* produz uma pessoa que espera para sempre. Mentir por
 * omissão aqui é pior do que a limitação.
 *
 * **Não há campo de código:** quem tem pedido em andamento não abre outro. O caminho de volta é a decisão
 * do Gestor, que é o item 8.
 */
function FaceB({ pedido }: { pedido: { organizacao: { nome: string }; criadoEm: string } }) {
  return (
    <MolduraDeTela titulo={`Seu pedido para entrar em ${pedido.organizacao.nome} está aguardando a decisão de um Gestor.`}>
      <p className="text-tinta-suave text-sm leading-relaxed">
        Você não será avisado automaticamente — volte aqui para ver.
      </p>

      <dl className="border-linha bg-superficie flex flex-col gap-1 rounded-md border px-4 py-3.5">
        <dt className="text-tinta-suave text-xs">Pedido enviado em</dt>
        <dd className="text-tinta text-base leading-snug font-medium">
          {formatarData(pedido.criadoEm)}
        </dd>
      </dl>

      <BotaoDeSair />
    </MolduraDeTela>
  );
}

/**
 * **Face C · Pedido recusado.** Um pedido `recusado`, nenhum pendente e nenhum vínculo.
 *
 * **O campo de código volta, e não é enfeite:** *"pedido recusado pode ser refeito"* é a suposição S4 do
 * modelo, e é o índice único **parcial** que a permite. Sem o campo, esta face é um beco — palavras do
 * protótipo.
 *
 * **O motivo da recusa não aparece, e é decisão de três documentos:** `GET /contexto` devolve `situacao`
 * e não o motivo; dizê-lo a quem foi recusado é decisão de produto ainda não tomada. A tela diz o que
 * aconteceu e o que fazer, e mais nada.
 */
function FaceC({ nome, organizacao }: { nome: string; organizacao: string }) {
  return (
    <MolduraDeTela titulo={`Seu pedido para entrar em ${organizacao} não foi aprovado.`}>
      <p className="text-tinta-suave text-sm leading-relaxed">
        Você pode pedir entrada de novo, aqui mesmo.
      </p>

      <FormularioDePedidoDeEntrada nome={nome} />

      <BotaoDeSair />
    </MolduraDeTela>
  );
}

/**
 * Data e hora em pt-BR, **com o fuso escrito por extenso**.
 *
 * **`FaceB` é Server Component**, então isto roda no servidor — e o servidor roda em UTC (modelo §2.3:
 * *"a nuvem roda em UTC enquanto os usuários estão em BRT"*). Sem `timeZone`, o pedido enviado às 22h de
 * uma terça apareceria como 01h de quarta, na primeira tela que este item entrega.
 *
 * O fuso do aparelho exigiria formatar no cliente, e formatar no cliente aqui custaria um componente
 * `"use client"` só para uma linha de texto — mais uma divergência de hidratação a administrar. **Um
 * produto de condomínio brasileiro tem um fuso**, e escrevê-lo é mais honesto que herdar o do contêiner.
 */
function formatarData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

/**
 * **Face D · Escolher a organização.** Dois ou mais vínculos e nenhum ativo — é a Persona 1B, o síndico que
 * também mora em outro prédio.
 *
 * **Nome e papel, nada mais:** não há contagem de ocorrências por organização, porque não há endpoint que a
 * dê sem organização ativa (contrato §4.4).
 *
 * **O botão passou a fazer no item 7b**, e com isso **o último `AvisoDeFatia` do produto saiu**. A lista
 * virou `EscolhaDeOrganizacao` — componente de cliente, porque escolher é gravar um cookie, e Server
 * Component em renderização não grava cookie (`com-contexto.ts:506-515`).
 *
 * **O pedido pendente aparece aqui e não some**, e é a outra metade do critério 7b.7: quem tem dois
 * vínculos e um pedido pendente deixou de cair na face B, então esta é a única tela em que ele ainda pode
 * ser visto antes de entrar em alguma organização.
 */
function FaceD({
  vinculos,
  pendente,
}: {
  vinculos: ReadonlyArray<{ organizacaoId: string; nome: string; papel: string }>;
  pendente: { organizacao: { nome: string }; criadoEm: string } | null;
}) {
  return (
    <MolduraDeTela titulo="Em qual organização você quer trabalhar?">
      <EscolhaDeOrganizacao vinculos={vinculos} />

      {pendente !== null && (
        <p className="text-tinta-suave text-sm leading-relaxed">
          Você também pediu entrada em{" "}
          <strong className="text-tinta font-semibold">{pendente.organizacao.nome}</strong>, em{" "}
          {formatarData(pendente.criadoEm)}. Ainda aguarda a decisão de um Gestor, e você não será avisado
          automaticamente.
        </p>
      )}

      <BotaoDeSair />
    </MolduraDeTela>
  );
}

/**
 * ============================================================================
 *  **Face E · Entrar em outra organização** — o item 7b, e é desenho novo
 * ============================================================================
 *
 * **Não está em documento nenhum, e o critério 7b.5 sabe disso:** *"A forma desse ponto não está escrita
 * em documento nenhum — o `inventario-de-telas.md` não a tem, e é lá que ela vai morar; este critério
 * confere que o caminho existe, **o desenho, não**."* É proposta, e vira achado — nunca conserto em
 * `docs/`.
 *
 * **A ordem de leitura é a resposta a três perguntas, nesta ordem:** *eu perco o que tenho?* — não;
 * *o que eu já pedi?* — isto aqui; *como peço mais um?* — o campo.
 *
 * **O bloco de pedidos não é enfeite: é o que torna verdadeira a frase da face B.** *"Você não será avisado
 * automaticamente — volte aqui para ver"* pressupõe um *aqui*, e **para quem tem organização ativa a face
 * B é inalcançável** — T-02 redireciona. Sem este bloco, o pedido feito nesta tela sumiria da vista no
 * instante seguinte.
 *
 * **O formulário NÃO some quando há pedido pendente**, e é a diferença explícita para a face A. Lá
 * *"pendente ganha de tudo"* porque quem não tem vínculo nenhum não deve abrir um segundo pedido. Aqui o
 * banco permite: o índice único é `(pessoa_id, organizacao_id) where situacao = 'pendente'`, **um por
 * organização**. A síndica que administra três prédios pede aos três.
 *
 * **O *Voltar* vai para `/`, e não para `/ocorrencias`.** `/` é o losango: ele reresolve o contexto e
 * despacha. Mandar para T-03 trancaria o Encarregado, que tem `permissoes: []` e **não tem T-03**
 * (`app/page.tsx:44-46`) — e é justamente ele o caso que o menu da T-10 existe para servir.
 */
function FaceE({
  organizacaoAtiva,
  vinculos,
  pedidos,
}: {
  organizacaoAtiva: { id: string; nome: string; codigoPublico: string };
  vinculos: ReadonlyArray<{ organizacaoId: string; nome: string; papel: string; codigoPublico: string }>;
  pedidos: ReadonlyArray<{ id: string; organizacao: { nome: string }; situacao: string; criadoEm: string }>;
}) {
  return (
    <MolduraDeTela titulo="Entrar em outra organização">
      {/* É a frase que o critério 7b.1 exige em palavras: *"o vínculo em A não é tocado"*. */}
      <p className="text-tinta-suave text-sm leading-relaxed">
        Você continua em{" "}
        <strong className="text-tinta font-semibold">{organizacaoAtiva.nome}</strong>. Pedir entrada em
        outra não tira você daqui.
      </p>

      {pedidos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">Seus pedidos</h2>
          <ul className="border-linha divide-linha-suave bg-superficie divide-y overflow-hidden rounded-md border">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="flex flex-col gap-0.5 px-4 py-3.5">
                <span className="text-tinta text-base leading-snug font-medium">
                  {pedido.organizacao.nome}
                </span>
                {/* A-5: a situação sempre carrega a palavra, nunca só uma cor. */}
                <span className="text-tinta-suave text-xs">
                  {rotuloDaSituacao(pedido.situacao)} · {formatarData(pedido.criadoEm)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FormularioDePedidoDeEntrada variante="outra-organizacao" vinculos={vinculos} />

      <Link href="/" className="text-marca py-1 text-sm underline underline-offset-4">
        Voltar
      </Link>
    </MolduraDeTela>
  );
}

/**
 * A situação do pedido em palavra.
 *
 * **O motivo da recusa não aparece**, e é a mesma decisão da face C: `GET /contexto` devolve `situacao` e
 * não o motivo, e dizê-lo a quem foi recusado é decisão de produto ainda não tomada (⬜, §6.15 do modelo).
 */
function rotuloDaSituacao(situacao: string): string {
  if (situacao === "aprovado") return "Aprovado";
  if (situacao === "recusado") return "Não aprovado";
  return "Aguardando a decisão de um Gestor";
}

function BotaoDeSair() {
  return (
    <form action={acaoDeSair} className="pt-2">
      <button type="submit" className="text-marca py-1 text-sm underline underline-offset-4">
        Sair
      </button>
    </form>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverParaTela();
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário, §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Forganizacao");
    throw erro;
  }
}
