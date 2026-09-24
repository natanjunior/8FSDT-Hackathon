import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { ConviteDaOutraPorta } from "@/interface/componentes/convite-da-outra-porta";
import { EscolhaDeOrganizacao } from "@/interface/componentes/escolha-de-organizacao";
import { FormularioDePedidoDeEntrada } from "@/interface/componentes/formulario-de-pedido-de-entrada";
import { dataEHora } from "@/interface/componentes/frases-de-participantes";
import { LinhaDeOrganizacao, ListaDeOrganizacoes } from "@/interface/componentes/lista-de-organizacoes";
import {
  CaminhoDeSair,
  CLASSE_DO_CAMINHO,
  MolduraDeConta,
} from "@/interface/componentes/moldura-de-conta";
import { resolverParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * **T-02 · Sem organização ativa** — *"Onde eu trabalho?"*
 *
 * Uma tela, **cinco faces**, e a face é escolhida por `GET /contexto` — o único endpoint que uma Pessoa
 * sem vínculo consegue usar. Aqui a leitura vai pela estrada direta, com a mesma projeção do route
 * handler.
 *
 * **As quatro primeiras são para quem não tem organização ativa.** A face **C** (pedido recusado) é
 * alcançável desde o item 8, que é quem produz `situacao: "recusado"`.
 *
 * **A quinta é a face E, e é o avesso das outras: ela só existe COM organização ativa** (item 7b). O que
 * ela entrega é o caminho que faltava para a Persona 1B: pedir entrada em outra organização **sem sair da
 * que se está**.
 *
 * **Desde o item 44o as cinco estão na moldura das telas fora da casca**, e **criar organização saiu
 * daqui**: virou a tela `/organizacao/criar`, alcançada pela outra porta da face A. Até o
 * 44o a face A empilhava dois formulários separados por um traço — o do código e o do nome da
 * organização —, e o dono os separou em 20/09/2026.
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
  // **A condição `vinculos.length === 0` é o critério 7b.7.** Sem ela, quem tem **dois vínculos, nenhum
  // ativo e um pedido pendente** cai aqui e só recebe *"Sair"* — trancado fora das duas organizações em
  // que já foi aceito. `escolherAtivo` devolve `null` com dois ou mais vínculos sem cookie válido
  // (`resolver-contexto.ts:170-177`), que é celular novo, aba anônima ou cookie expirado.
  const pendente = contexto.pedidosDeEntrada.find((pedido) => pedido.situacao === "pendente");
  if (pendente !== undefined && contexto.vinculos.length === 0) return <FaceB pedido={pendente} />;

  // **Face C — recusado.** A lista vem em `criadoEm` decrescente, então o primeiro recusado é o mais
  // recente. Só aparece para quem não tem vínculo nenhum: quem foi recusado em B e entrou em A tem
  // organização ativa e nem chega aqui.
  const recusado = contexto.pedidosDeEntrada.find((pedido) => pedido.situacao === "recusado");
  if (recusado !== undefined && contexto.vinculos.length === 0) {
    return <FaceC nome={contexto.pessoa.nome} organizacao={recusado.organizacao.nome} />;
  }

  if (contexto.vinculos.length >= 2) {
    return <FaceD vinculos={contexto.vinculos} pendente={pendente ?? null} />;
  }
  return <FaceA nome={contexto.pessoa.nome} />;
}

/** O nome de uma organização dentro de uma frase: é o que a pessoa procura na tela. */
function NomeDaOrganizacao({ children }: { children: string }) {
  return <strong className="text-tinta font-semibold">{children}</strong>;
}

/** Uma data no formato do guia §7, em mono — guia §3: dado temporal é monoespaçado. */
function Data({ iso }: { iso: string }) {
  return <span className="font-mono tabular-nums">{dataEHora(iso)}</span>;
}

/**
 * **Face A · Entrar em uma organização.** `vinculos: []` e `pedidosDeEntrada: []` — acabou de criar a conta.
 *
 * **É o estado vazio, e por isso é convite e não aviso.** O cartão tem **um formulário só**, o do código;
 * criar organização é a outra porta, ao lado do cartão na tela grande e abaixo dele no celular (item 65).
 * **Só a face A o oferece**: a face C é a tela de quem acabou de ser recusado, e a face E é de quem já tem
 * organização — fundar uma segunda tendo uma ativa está fora desta entrega.
 */
function FaceA({ nome }: { nome: string }) {
  return (
    <MolduraDeConta
      titulo="Entrar em uma organização"
      contexto="Você ainda não participa de nenhuma. Use o código que recebeu para pedir entrada."
      convite={{
        lado: "direita",
        conteudo: (
          <ConviteDaOutraPorta
            titulo="Sua organização ainda não usa o Resolve Aí?"
            frase="Condomínio, empresa ou bairro: quem cria a organização cuida dela."
            itens={[
              "Você vira o Gestor",
              "Recebe um código para distribuir",
              "Categorias e áreas já vêm prontas",
            ]}
            rotulo="Criar uma organização"
            href="/organizacao/criar"
          />
        ),
      }}
      caminhos={<CaminhoDeSair />}
    >
      <FormularioDePedidoDeEntrada nome={nome} />
    </MolduraDeConta>
  );
}

/**
 * **Face B · Pedido enviado.** `vinculos: []` e um pedido `pendente`.
 *
 * **A linha de fato diz onde a resposta aparece, e a redação importa.** O aviso automático de aprovação
 * não existe nesta entrega, e uma tela que diz *"aguarde"* sem dizer **onde** produz uma pessoa que fecha
 * a aba esperando um e-mail que nunca vem. *"Um Gestor decide, e a resposta aparece aqui."* faz esse
 * trabalho sem anunciar a lacuna — é a frase do critério 44o.7, que juntou numa linha o título e o
 * parágrafo de antes.
 *
 * **A data é linha de meta, e não caixa.** O bloco *"Pedido enviado em"* repetiria o título, e o guia §1
 * reserva a caixa para o que agrupa naturezas diferentes.
 *
 * **Não há campo de código:** quem tem pedido em andamento não abre outro. O caminho de volta é a decisão
 * do Gestor, que é o item 8.
 */
function FaceB({ pedido }: { pedido: { organizacao: { nome: string }; criadoEm: string } }) {
  return (
    <MolduraDeConta
      titulo="Pedido enviado"
      contexto={
        <>
          Você pediu entrada em <NomeDaOrganizacao>{pedido.organizacao.nome}</NomeDaOrganizacao>.{" "}
          Um Gestor decide, e a resposta aparece aqui.
        </>
      }
      caminhos={<CaminhoDeSair />}
    >
      <p className="text-meta text-tinta-suave">
        Enviado em <Data iso={pedido.criadoEm} />
      </p>
    </MolduraDeConta>
  );
}

/**
 * **Face C · Pedido não aprovado.** Um pedido `recusado`, nenhum pendente e nenhum vínculo.
 *
 * **O campo de código volta, e não é enfeite:** *"pedido recusado pode ser refeito"* é a suposição S4 do
 * modelo, e é o índice único **parcial** que a permite. Sem o campo, esta face é um beco.
 *
 * **O motivo da recusa não aparece:** `GET /contexto` devolve `situacao` e não o motivo, e dizê-lo a quem
 * foi recusado é decisão de produto ainda não tomada. A tela diz o que aconteceu e o que fazer, numa linha
 * só (critério 44o.7), e mais nada.
 */
function FaceC({ nome, organizacao }: { nome: string; organizacao: string }) {
  return (
    <MolduraDeConta
      titulo="Pedido não aprovado"
      contexto={
        <>
          Seu pedido para entrar em <NomeDaOrganizacao>{organizacao}</NomeDaOrganizacao> não foi aprovado.
          Você pode pedir de novo, aqui mesmo.
        </>
      }
      caminhos={<CaminhoDeSair />}
    >
      <FormularioDePedidoDeEntrada nome={nome} />
    </MolduraDeConta>
  );
}

/**
 * **Face D · Escolher a organização.** Dois ou mais vínculos e nenhum ativo — é a Persona 1B, o síndico que
 * também mora em outro prédio.
 *
 * **Nome e papel, nada mais:** não há contagem de ocorrências por organização, porque não há endpoint que
 * a dê sem organização ativa. A lista é a `EscolhaDeOrganizacao` — componente de cliente, porque escolher
 * é gravar um cookie, e Server Component em renderização não grava cookie.
 *
 * **A linha de fato diz que a escolha não é para sempre** (critério 44o.7): o nome da organização no alto
 * da tela, dentro do produto, é o seletor.
 *
 * **O pedido pendente aparece aqui e não some**, e é a outra metade do critério 7b.7: quem tem dois
 * vínculos e um pedido pendente não cai na face B, então esta é a única tela em que ele ainda pode ser
 * visto antes de entrar em alguma organização — e é por isso que *"a resposta aparece aqui"* é
 * literalmente verdade.
 */
function FaceD({
  vinculos,
  pendente,
}: {
  vinculos: ReadonlyArray<{ organizacaoId: string; nome: string; papel: string }>;
  pendente: { organizacao: { nome: string }; criadoEm: string } | null;
}) {
  return (
    <MolduraDeConta
      titulo="Em qual organização você quer trabalhar?"
      contexto="Dá para trocar depois, pelo nome no alto da tela."
      caminhos={<CaminhoDeSair />}
    >
      <EscolhaDeOrganizacao vinculos={vinculos} />

      {pendente !== null && (
        <p className="text-corpo text-tinta-suave">
          Você também pediu entrada em <NomeDaOrganizacao>{pendente.organizacao.nome}</NomeDaOrganizacao>,
          em <Data iso={pendente.criadoEm} />. Ainda aguarda a decisão de um Gestor — a resposta aparece
          aqui.
        </p>
      )}
    </MolduraDeConta>
  );
}

/**
 * ============================================================================
 *  **Face E · Entrar em outra organização** — o item 7b
 * ============================================================================
 *
 * **Não estava em documento nenhum quando nasceu**, e o critério 7b.5 sabia disso. Ganhou desenho na
 * prancheta *"Sala de entrada"*, em 20/09/2026 (item 44o).
 *
 * **A ordem de leitura é a resposta a três perguntas, nesta ordem:** *eu perco o que tenho?* — não, e é a
 * linha de fato; *o que eu já pedi?* — a lista; *como peço mais um?* — o campo.
 *
 * **A lista de pedidos não é enfeite: é o que torna verdadeira a frase da face B.** *"Um Gestor decide, e
 * a resposta aparece aqui"* pressupõe um *aqui*, e **para quem tem organização ativa a face B é
 * inalcançável** — T-02 redireciona. Sem esta lista, o pedido feito nesta tela sumiria da vista no
 * instante seguinte. **Ela usa a forma da lista de organizações sem a seta** (critério 44o.10): pedido
 * não leva a lugar nenhum.
 *
 * **O formulário NÃO some quando há pedido pendente**, e é a diferença explícita para a face A: o banco
 * permite um pedido pendente **por organização**, e a síndica que administra três prédios pede aos três.
 *
 * **O *Voltar* vai para `/`, e não para `/ocorrencias`.** `/` é o losango: ele reresolve o contexto e
 * despacha. Mandar para T-03 trancaria o Encarregado, que não tem T-03 — e é justamente ele que chega
 * aqui pelo caminho de T-10.
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
    <MolduraDeConta
      titulo="Entrar em outra organização"
      contexto={
        // É a frase que o critério 7b.1 exige em palavras: *"o vínculo em A não é tocado"*.
        <>
          Você continua em <NomeDaOrganizacao>{organizacaoAtiva.nome}</NomeDaOrganizacao>. Pedir entrada em
          outra não tira você daqui.
        </>
      }
      caminhos={
        <Link href="/" className={CLASSE_DO_CAMINHO}>
          Voltar
        </Link>
      }
    >
      {pedidos.length > 0 && (
        <ListaDeOrganizacoes rotulo="Seus pedidos">
          {pedidos.map((pedido) => (
            <li key={pedido.id}>
              <LinhaDeOrganizacao
                nome={pedido.organizacao.nome}
                apoio={
                  // A-5: a situação sempre carrega a palavra, nunca só uma cor.
                  <>
                    {rotuloDaSituacao(pedido.situacao)} · <Data iso={pedido.criadoEm} />
                  </>
                }
              />
            </li>
          ))}
        </ListaDeOrganizacoes>
      )}

      <FormularioDePedidoDeEntrada variante="outra-organizacao" vinculos={vinculos} />
    </MolduraDeConta>
  );
}

/**
 * A situação do pedido em palavra.
 *
 * **O motivo da recusa não aparece**, e é a mesma decisão da face C: `GET /contexto` devolve `situacao` e
 * não o motivo, e dizê-lo a quem foi recusado é decisão de produto ainda não tomada.
 */
function rotuloDaSituacao(situacao: string): string {
  if (situacao === "aprovado") return "Aprovado";
  if (situacao === "recusado") return "Não aprovado";
  return "Aguardando a decisão de um Gestor";
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverParaTela();
  } catch (erro) {
    // Sem sessão vai para T-01, guardando o destino pretendido.
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Forganizacao");
    throw erro;
  }
}
