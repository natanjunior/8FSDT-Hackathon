import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  OcorrenciaNaoEncontrada,
  podeLerOcorrencia,
  verOcorrencia,
  verTrilhaDeAuditoria,
} from "@/aplicacao/ocorrencia";
import { OcorrenciaNaoEncontradaNaTela } from "@/interface/componentes/ocorrencia-nao-encontrada";
import { CAMPO_VAZIO, dataHoraComSegundos } from "@/interface/componentes/trilha-de-auditoria";
import { novoTraceId, registrarFalha, resolverEscopoParaTela } from "@/interface/http";
import { projetarTransicao } from "@/interface/projecoes";

/**
 * ============================================================================
 *  T-06 · Trilha de auditoria — a tela que responde "prove"
 * ============================================================================
 *
 * **Endereço próprio, e é a tela que mais precisa de um** (`inventario-de-telas.md`, T-06): é o que se
 * leva para a assembleia, para a imobiliária e para quem avalia. *"Cada transição de status deve ser
 * auditável"* é o requisito central do enunciado, e esta é a superfície dele.
 *
 * **Ela chega no item 41b, e a razão de ter demorado é estrutural, não descuido:** a tela está pendurada
 * na **capacidade 37** (`trabalho/backlog.md:968`), que é *"restrição, não tarefa"* e por construção não
 * vira item. Nenhuma spec podia entregá-la porque não havia item a que ela pertencesse. Ver os critérios
 * **41b.6** e **41b.7**.
 *
 * **A leitura vai pela estrada direta**, como T-05 e T-03: `app/` não monta repositório, e um `fetch`
 * interno custaria o salto HTTP que a §5 do contrato recusou. **São as MESMAS duas leituras do
 * `route.ts`** — `verOcorrencia` (a guarda e o título) e `verTrilhaDeAuditoria` —, e a projeção é a
 * **mesma função**: `projetarTransicao`. Dois transportes que projetassem por conta própria divergiriam,
 * e a §5 existe para impedir isso.
 *
 * **Nenhuma ação, em lugar nenhum** (critério 41b.6). É a expressão de interface da invariante 3 do
 * agregado — *"o histórico é append-only"* — e da §9.1 do contrato: não existe `POST`, não existe
 * `PATCH`, não existe `DELETE` sobre registro de transição, e não pode existir. Se um dia aparecer botão
 * aqui, a garantia central do produto terá sido perdida.
 *
 * **Vocabulário de máquina, de propósito.** `statusAnterior`, `statusNovo`, `motivoPausa` e
 * `motivoCancelamento` saem **crus**, sem `rotuloDeStatus` e sem lente: *"auditoria que traduz não é
 * auditoria"*. É a única tela do produto assim, e a consequência — o Solicitante lê `em_analise` — está
 * assumida no `backlog.md`, sob o 41b, e **não é regressão do rótulo por papel** do item 31.
 *
 * **O autor vai pelo nome, sempre**, nunca *"Você"*: a segunda pessoa é da linha do tempo (`autoria()`),
 * e numa trilha ela apagaria de quem é o registro.
 */
export const dynamic = "force-dynamic";

export default async function TrilhaDeAuditoria({
  params,
}: {
  params: Promise<{ ocorrenciaId: string }>;
}) {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.ler_propria");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") redirect("/");

  const { ocorrenciaId } = await params;

  /**
   * **Montado uma vez, usado pelos dois caminhos que dão o mesmo `404`** — o erro do `verOcorrencia` e a
   * recusa do `podeLerOcorrencia`. As duas causas dão a mesma resposta, de propósito (§6.3): a tela não
   * confirma a existência do que quem lê não pode alcançar.
   *
   * **A estrada direta não passa pelo `comContexto`**, então o `traceId` nasce aqui — e a linha de log é
   * a MESMA que `registrarEResponder` escreve, pela mesma função. Nunca uma segunda cópia do formato.
   */
  const resolucao = escopo.resolucao;
  const naoEncontrada = () => {
    const traceId = novoTraceId();
    registrarFalha(
      new OcorrenciaNaoEncontrada(),
      `/ocorrencias/${ocorrenciaId}/auditoria`,
      "GET",
      traceId,
    );

    return (
      <OcorrenciaNaoEncontradaNaTela
        organizacaoAtiva={
          resolucao.ativo === null ? null : { nome: resolucao.ativo.organizacao.nome }
        }
        traceId={traceId}
      />
    );
  };

  // **A MESMA regra da rota e de T-05**, e ela é função da Aplicação chamada por quem tem o `Vinculo` —
  // nunca uma quarta cópia da condição de leitura.
  const quem = {
    pessoaId: escopo.ctx.pessoaId,
    podeLerTodas: escopo.ctx.vinculo.pode("ocorrencia.ler_todas"),
  };

  let lida;
  try {
    lida = await verOcorrencia(escopo.repos.ocorrencias, ocorrenciaId);
  } catch (erro) {
    if (erro instanceof OcorrenciaNaoEncontrada) return naoEncontrada();
    throw erro;
  }

  if (!podeLerOcorrencia(lida, quem)) return naoEncontrada();

  const registros = (await verTrilhaDeAuditoria(escopo.repos.ocorrencias, ocorrenciaId)).map(
    projetarTransicao,
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
      <h1 className="text-tinta text-xl leading-snug font-semibold">Trilha de auditoria</h1>
      {/* O título da ocorrência abaixo do `<h1>`, como o protótipo o põe na barra da tela grande e no
          subtítulo do celular. **Não entra no `<h1>`:** o título da tela é o que ela é, não sobre o que
          ela é. */}
      <p className="text-tinta-suave text-sm leading-snug">{lida.titulo}</p>

      {registros.length === 0 ? (
        <TrilhaVaziaEhDefeito
          ocorrenciaId={lida.id}
          organizacaoId={escopo.ctx.vinculo.organizacaoId}
        />
      ) : (
        <>
          <TabelaDaTrilha registros={registros} />
          <BlocosDaTrilha registros={registros} />
        </>
      )}

      {/* **A-3:** alvo de toque. **É a única navegação da tela** — o inventário: *"só navegação de volta a
          T-05"*. */}
      <Link
        href={`/ocorrencias/${lida.id}`}
        className="text-marca inline-flex min-h-11 w-fit items-center text-sm font-medium underline underline-offset-4"
      >
        ← voltar à ocorrência
      </Link>
    </div>
  );
}

/** O que a projeção devolve, por registro. **É o `RegistroDeTransicao` do contrato**, sem `sequencia`. */
type RegistroProjetado = ReturnType<typeof projetarTransicao>;

/**
 * **Recorte de tela grande — o compromisso A-7, *tabela de verdade*.**
 *
 * **Quatro colunas e uma linha de continuação, e não sete colunas.** É o achado **P-07** do protótipo —
 * *"os cinco campos do F5 não são cinco colunas"* — e é como `telas.html:3030-3090` desenha: as três
 * primeiras colunas têm largura fixa, a do autor fica livre (é o único campo que pode chegar a 120
 * caracteres), e o parágrafo da observação mora numa célula que ocupa a largura toda, de modo que ele
 * **só pode crescer para baixo**.
 *
 * **A linha de continuação carrega o NOME de cada campo**, e é o que a torna legítima. A objeção contra
 * duas `<tr>` por registro está escrita em `lista-de-ocorrencias.tsx:373-376` — *"numa tabela, uma linha
 * é um registro, e duas `<tr>` por ocorrência mentem para quem navega por leitor de tela"* —, e ela vale
 * lá porque a segunda linha repetiria dados sob colunas erradas. **Aqui a célula se auto-rotula**, que é
 * a mesma escolha que o protótipo faz no celular: *"é verboso de propósito: quem lê esta tela está
 * provando algo, e prova sem rótulo de campo é afirmação"*.
 *
 * **O `<caption>` não é enfeite:** a ordem *do mais antigo para o mais recente* é regra do inventário e
 * não estaria visível em lugar nenhum sem ele — *"uma trilha lida na ordem errada prova o contrário do
 * que aconteceu"* — e ele dá nome à tabela para leitor de tela, que é o que o A-7 existe para proteger.
 *
 * **`overflow-x-auto` no invólucro** porque a página nunca rola na horizontal; quem rola é a tabela.
 */
function TabelaDaTrilha({ registros }: { registros: readonly RegistroProjetado[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="text-tinta-fraca pb-2 text-left text-xs leading-relaxed">
          {registros.length === 1 ? "Um registro" : `${String(registros.length)} registros`}, do mais
          antigo para o mais recente — o oposto da lista de ocorrências, e de propósito: uma trilha se lê
          do começo.
        </caption>
        <thead>
          <tr className="text-tinta-suave border-linha border-b">
            <th scope="col" className="w-44 py-2 pr-3 font-medium">
              De
            </th>
            <th scope="col" className="w-48 py-2 pr-3 font-medium">
              Novo status
            </th>
            <th scope="col" className="w-52 py-2 pr-3 font-medium">
              Quando
            </th>
            <th scope="col" className="py-2 font-medium">
              Autor da transição
            </th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro, indice) => (
            <Fragment key={`${registro.ocorreuEm}-${String(indice)}`}>
              <tr className="align-top">
                {/* **`statusAnterior` nulo SÓ no registro de criação** — a premissa P1, e é a origem da
                    trilha. **A-5:** o nada carrega um caractere, nunca uma célula em branco. */}
                <td className="py-2 pr-3 font-mono">{registro.statusAnterior ?? CAMPO_VAZIO}</td>
                <td className="py-2 pr-3 font-mono">{registro.statusNovo}</td>
                <td className="py-2 pr-3 font-mono tabular-nums whitespace-nowrap">
                  {dataHoraComSegundos(registro.ocorreuEm)}
                </td>
                <td className="py-2">{registro.autor.nome}</td>
              </tr>
              <tr className="border-linha border-b">
                <td colSpan={4} className="text-tinta-suave pb-3 text-xs leading-relaxed">
                  {registro.motivoPausa !== null && (
                    <span className="block">
                      motivo da pausa: <span className="font-mono">{registro.motivoPausa}</span>
                    </span>
                  )}
                  {registro.motivoCancelamento !== null && (
                    <span className="block">
                      motivo do cancelamento:{" "}
                      <span className="font-mono">{registro.motivoCancelamento}</span>
                    </span>
                  )}
                  <span className="block whitespace-pre-line">
                    observação:{" "}
                    {registro.observacao ?? <span className="font-mono">{CAMPO_VAZIO}</span>}
                  </span>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * **Recorte de celular — o mesmo registro empilhado, e nenhum campo escondido.**
 *
 * É a única restrição que o passo 5 herda do inventário: *"no celular, cada registro vira um bloco
 * empilhado sem perder nenhum campo — **nenhum dos cinco campos do F5 pode ser escondido por falta de
 * espaço**"*. Por isso não há tabela reduzida nem coluna sacrificada: há a lista inteira, com o nome do
 * campo à esquerda de cada valor.
 *
 * **Os registros são numerados**, como o quadro 3 do protótipo. O número é posição na trilha, e é o que
 * permite alguém dizer *"o registro 4"* ao telefone.
 */
function BlocosDaTrilha({ registros }: { registros: readonly RegistroProjetado[] }) {
  return (
    <ol className="flex flex-col gap-3 md:hidden">
      {registros.map((registro, indice) => (
        <li
          key={`${registro.ocorreuEm}-${String(indice)}`}
          className="border-linha bg-superficie flex flex-col gap-1 rounded-md border px-4 py-3"
        >
          <span className="text-tinta-fraca text-xs font-semibold">{indice + 1}</span>
          <CampoDoBloco nome="de" valor={registro.statusAnterior ?? CAMPO_VAZIO} mono />
          <CampoDoBloco nome="para" valor={registro.statusNovo} mono />
          <CampoDoBloco nome="em" valor={dataHoraComSegundos(registro.ocorreuEm)} mono />
          <CampoDoBloco nome="autor da transição" valor={registro.autor.nome} />
          {registro.motivoPausa !== null && (
            <CampoDoBloco nome="motivo da pausa" valor={registro.motivoPausa} mono />
          )}
          {registro.motivoCancelamento !== null && (
            <CampoDoBloco nome="motivo do cancelamento" valor={registro.motivoCancelamento} mono />
          )}
          <CampoDoBloco
            nome="observação"
            valor={registro.observacao ?? CAMPO_VAZIO}
            mono={registro.observacao === null}
          />
        </li>
      ))}
    </ol>
  );
}

/** Uma linha `nome: valor` do bloco de celular. O nome do campo **sempre** aparece — A-5. */
function CampoDoBloco({
  nome,
  valor,
  mono = false,
}: {
  nome: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <span className="text-tinta-suave block text-xs leading-relaxed">
      {nome}:{" "}
      <span className={`text-tinta font-medium whitespace-pre-line ${mono ? "font-mono" : ""}`}>
        {valor}
      </span>
    </span>
  );
}

/**
 * **O quadro 5 do protótipo — e ele existe porque o vazio aqui NÃO é um estado.**
 *
 * Esta é a única lista do produto que não pode estar vazia: a premissa **P1** faz a criação gravar o
 * primeiro registro, então toda ocorrência tem ao menos um. *"Se esta tela aparecer vazia algum dia, a
 * invariante 2 da ADR-0001 foi violada — e vale dizer isso ao implementador: **um estado vazio aqui é um
 * defeito, não um estado**"* (`inventario-de-telas.md`, T-06).
 *
 * **Por que construir o que não pode acontecer.** Sem este bloco, o defeito apareceria como uma tabela
 * com cabeçalho e nenhuma linha — indistinguível de *"ainda não aconteceu nada"*, que é falso e é a
 * leitura que alguém faria. Os dois identificadores estão na tela porque é o que quem for investigar
 * precisa levar, e porque este caminho chega como `200` com lista vazia: **não há `traceId`**, e isso é o
 * achado que o próprio protótipo já registrou (última OBS de T-06 em `telas.html`).
 */
function TrilhaVaziaEhDefeito({
  ocorrenciaId,
  organizacaoId,
}: {
  ocorrenciaId: string;
  organizacaoId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p
        role="alert"
        className="border-destructive/40 bg-superficie text-tinta rounded-md border px-4 py-3 text-sm leading-relaxed"
      >
        <strong className="font-semibold">
          Esta trilha está vazia, e isso é um defeito — não é um estado.
        </strong>{" "}
        Toda ocorrência tem ao menos um registro: a criação grava o primeiro, com status anterior nulo.
        Uma trilha sem nenhum registro significa que a invariante 2 da ADR-0001 foi violada — o status foi
        gravado sem que o registro de transição fosse gravado na mesma operação. Não adianta recarregar: o
        que falta aqui não existe do outro lado.
      </p>
      <p className="text-tinta-suave text-xs leading-relaxed">
        Leve estes dois valores a quem mantém o sistema — eles identificam a ocorrência e a organização em
        que ela foi lida:
      </p>
      <p className="text-tinta-fraca font-mono text-xs leading-relaxed">
        <span className="block select-all">ocorrenciaId: {ocorrenciaId}</span>
        <span className="block select-all">organizacaoId: {organizacaoId}</span>
      </p>
    </div>
  );
}
