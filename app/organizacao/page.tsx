import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { acaoDeSair } from "@/interface/acoes";
import { FormularioDeNovaOrganizacao } from "@/interface/componentes/formulario-de-nova-organizacao";
import { Campo, MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { resolverParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * **T-02 · Sem organização ativa** — *"Onde eu trabalho?"*
 *
 * Uma tela, **quatro faces**, e a face é escolhida por `GET /contexto` — o único endpoint que uma Pessoa sem
 * vínculo consegue usar (contrato §8.0). Aqui a leitura vai pela **estrada direta** da §5, com a mesma
 * projeção do route handler.
 *
 * **Nesta fatia existem duas faces, A e D.** As faces **B** (esperando aprovação) e **C** (pedido recusado)
 * dependem de `pedidosDeEntrada`, e `POST /pedidos-de-entrada` está fora da fatia — então nenhum pedido pode
 * existir, e as duas faces são **inalcançáveis por construção**, não escondidas.
 *
 * **Dois botões ainda não funcionam, e isso está dito na tela.** Pedir entrada e escolher organização são
 * `POST /pedidos-de-entrada` e `PUT /contexto/organizacao` — os dois fora desta fatia. Um botão morto e
 * mudo seria pior que um botão ausente; um botão morto que **diz que ainda não faz** é o desenho aparecendo
 * antes da função, que é o propósito do esqueleto.
 */
export const dynamic = "force-dynamic";

export default async function TelaSemOrganizacaoAtiva() {
  const resolucao = await resolverOuMandarParaPorta();
  const contexto = projetarContexto(resolucao);

  // Quem tem organização ativa não pertence a esta tela: o shell decide para onde vai.
  if (contexto.organizacaoAtiva !== null) redirect("/");

  return contexto.vinculos.length >= 2 ? (
    <FaceD vinculos={contexto.vinculos} />
  ) : (
    <FaceA nome={contexto.pessoa.nome} />
  );
}

/**
 * **Face A · Entrar em uma organização.** `vinculos: []` e `pedidosDeEntrada: []` — acabou de criar a conta.
 *
 * **É o estado vazio, e por isso é convite e não aviso.** Dois caminhos, com hierarquia clara: quem chega
 * aqui quase sempre está **entrando**, não fundando.
 */
function FaceA({ nome }: { nome: string }) {
  return (
    <MolduraDeTela titulo="Você ainda não está em nenhuma organização.">
      <AvisoDeFatia>
        Pedir entrada com o código chega na próxima tarefa. Criar uma organização já funciona — e a
        organização nasce com as sete categorias do desafio e duas áreas para você ajustar.
      </AvisoDeFatia>

      <form className="flex flex-col gap-5">
        <Campo
          id="codigo"
          rotulo="Código da organização"
          ajuda="Está no cartaz do elevador ou na mensagem do grupo. Seis a doze letras e números."
        >
          <Input
            id="codigo"
            name="codigo"
            type="text"
            maxLength={12}
            autoComplete="off"
            disabled
            className="h-12 text-base tracking-[0.12em] uppercase"
          />
        </Campo>

        <Campo
          id="nome"
          rotulo="Seu nome"
          ajuda={
            <>
              É como você vai aparecer para os Gestores e no histórico das ocorrências.{" "}
              <strong className="text-tinta font-semibold">Depois daqui não há como mudar.</strong>
            </>
          }
        >
          <Input
            id="nome"
            name="nome"
            type="text"
            maxLength={120}
            defaultValue={nome}
            disabled
            className="h-12 text-base"
          />
        </Campo>

        <Campo
          id="telefone"
          rotulo="Telefone (opcional)"
          ajuda="Vai virar o seu primeiro contato na organização."
        >
          <Input
            id="telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            defaultValue="+55 "
            disabled
            className="h-12 text-base"
          />
        </Campo>

        <Button type="button" disabled className="h-12 w-full text-base">
          Pedir entrada
        </Button>
      </form>

      <hr className="border-linha-suave my-1" />

      <p className="text-tinta-suave text-sm leading-relaxed">
        Você administra um condomínio, empresa ou bairro que ainda não usa o Resolve Aí?
      </p>
      <FormularioDeNovaOrganizacao />

      <BotaoDeSair />
    </MolduraDeTela>
  );
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
