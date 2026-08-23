import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { acaoDeSair } from "@/interface/acoes";
import { FormularioDeNovaOrganizacao } from "@/interface/componentes/formulario-de-nova-organizacao";
import { FormularioDePedidoDeEntrada } from "@/interface/componentes/formulario-de-pedido-de-entrada";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { resolverParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * **T-02 · Sem organização ativa** — *"Onde eu trabalho?"*
 *
 * Uma tela, **quatro faces**, e a face é escolhida por `GET /contexto` — o único endpoint que uma Pessoa
 * sem vínculo consegue usar (contrato §8.0). Aqui a leitura vai pela **estrada direta** da §5, com a mesma
 * projeção do route handler.
 *
 * **Nesta fatia existem três faces: A, B e D.** A face **C** (pedido recusado) depende de
 * `situacao: "recusado"`, e quem a produz é `POST /pedidos-de-entrada/{id}/recusar` — o item 8. Ela é
 * **inalcançável por construção**, não escondida, e sobe com aquele item.
 *
 * **Com o item 1 mesclado, as duas ações da face A funcionam** — pedir entrada é esta linha, criar
 * organização é o item 1. O que continua fora é **escolher** organização na face D, que é o item 7b, e é
 * o único botão que ainda diz na tela que não faz.
 */
export const dynamic = "force-dynamic";

export default async function TelaSemOrganizacaoAtiva() {
  const resolucao = await resolverOuMandarParaPorta();
  const contexto = projetarContexto(resolucao);

  // Quem tem organização ativa não pertence a esta tela: o shell decide para onde vai.
  if (contexto.organizacaoAtiva !== null) redirect("/");

  // **Pendente ganha de tudo.** Quem tem pedido em andamento não deve ser convidado a abrir outro — e é
  // por isso que a face B não tem campo de código.
  const pendente = contexto.pedidosDeEntrada.find((pedido) => pedido.situacao === "pendente");
  if (pendente !== undefined) return <FaceB pedido={pendente} />;

  if (contexto.vinculos.length >= 2) return <FaceD vinculos={contexto.vinculos} />;
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
 */
function FaceD({
  vinculos,
}: {
  vinculos: ReadonlyArray<{ organizacaoId: string; nome: string; papel: string }>;
}) {
  return (
    <MolduraDeTela titulo="Em qual organização você quer trabalhar?">
      <AvisoDeFatia>
        Escolher a organização chega na próxima tarefa — é o <code>PUT /contexto/organizacao</code>, que está
        fora desta fatia.
      </AvisoDeFatia>

      <ul className="border-linha divide-linha-suave bg-superficie divide-y overflow-hidden rounded-md border">
        {vinculos.map((vinculo) => (
          <li key={vinculo.organizacaoId} className="flex flex-col gap-0.5 px-4 py-3.5">
            <span className="text-tinta text-base leading-snug font-medium">{vinculo.nome}</span>
            {/* A-5: nada é comunicado só por cor — o papel sempre carrega a palavra. */}
            <span className="text-tinta-suave text-xs">{rotuloDoPapel(vinculo.papel)}</span>
          </li>
        ))}
      </ul>

      <BotaoDeSair />
    </MolduraDeTela>
  );
}

function AvisoDeFatia({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-linha bg-superficie text-tinta-suave rounded-md border border-dashed px-3 py-2.5 text-xs leading-relaxed">
      {children}
    </p>
  );
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

function rotuloDoPapel(papel: string): string {
  if (papel === "gestor") return "Gestor";
  if (papel === "encarregado") return "Encarregado";
  return "Solicitante";
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
