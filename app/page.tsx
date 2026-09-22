import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { EscolhaDeOrganizacao } from "@/interface/componentes/escolha-de-organizacao";
import { primeiroNome, rotuloDoPapel } from "@/interface/componentes/frases-de-participantes";
import {
  CaminhoDeSair,
  CLASSE_DO_CAMINHO,
  MolduraDeConta,
} from "@/interface/componentes/moldura-de-conta";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * ============================================================================
 *  O despachante — e a tela do vínculo sem permissões
 * ============================================================================
 *
 * **Duas coisas, e mais nenhuma.** Não há tela desenhada para `/`: o que existe ali é o losango *"tem
 * organização ativa?"*, que desemboca em T-01, T-02, T-10 ou T-03.
 *
 * | Situação | Destino |
 * |---|---|
 * | sem sessão | **T-01** (`/entrar`) |
 * | `organizacaoAtiva == null` | **T-02** (`/organizacao`) |
 * | com `ocorrencia.ler_propria` | **T-03** (`/ocorrencias`) |
 * | `permissoes: []` | **fica aqui** — é T-10 |
 *
 * **Não há laço:** `/` só redireciona **com** `ocorrencia.ler_propria`, e T-03 só devolve para cá **sem**
 * ela. As condições são complementares porque só existem três papéis: `solicitante` e `gestor` a têm,
 * `encarregado` tem `[]` (`Permissao.ts`).
 *
 * ---------------------------------------------------------------------------
 *  T-10, na moldura das telas fora da casca — item 44o
 * ---------------------------------------------------------------------------
 *
 * **O título continua sendo a saudação**, com o primeiro nome: o critério 44o.7 diz quais títulos mudam,
 * e T-10 não está entre eles. **A linha de fato é a frase do critério 44o.8**, com o papel e a
 * organização lidos do contexto — a tela existe pela **ausência de permissão**, e não pelo nome do papel.
 *
 * **O que a pessoa pode fazer daqui são duas coisas, e as duas saem desta tela:** trocar para outra
 * organização em que ela já participa — a lista *"Você também participa de"*, critério 44o.9 — ou pedir
 * entrada numa nova — o caminho abaixo do cartão, critério 44o.14. Com uma organização só, a lista não
 * aparece; o caminho, sim.
 *
 * **O caminho para a face E existe aqui e no menu de pessoa, e são as duas únicas portas dela.** O
 * seletor da barra superior virou `select` no 44b e não o carrega. Tirar este link sem pôr outro no lugar
 * deixa a face E alcançável só por endereço digitado — foi o que o critério 9 quase fez.
 */
export const dynamic = "force-dynamic";

export default async function Despachante() {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.ler_propria");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "pronto") redirect("/ocorrencias");

  const contexto = projetarContexto(escopo.resolucao);
  const ativa = contexto.organizacaoAtiva;
  // `sem-permissao` só existe com vínculo ativo, então os dois nulos são inalcançáveis. O `redirect` é o
  // mesmo destino de quem não tem organização, e é o que estreita os tipos sem asserção.
  if (ativa === null || contexto.papel === null) redirect("/organizacao");

  const outras = contexto.vinculos.filter((vinculo) => vinculo.organizacaoId !== ativa.id);

  return (
    <MolduraDeConta
      titulo={`Olá, ${primeiroNome(contexto.pessoa.nome)}.`}
      contexto={
        <>
          Seu papel de {rotuloDoPapel(contexto.papel)} em{" "}
          <strong className="text-tinta font-semibold">{ativa.nome}</strong> ainda não abre nenhuma tela.
          Quando abrir, ela aparece aqui.
        </>
      }
      caminhos={
        <>
          <Link href="/organizacao?entrar-em-outra=true" className={CLASSE_DO_CAMINHO}>
            Entrar em outra organização
          </Link>
          <CaminhoDeSair />
        </>
      }
    >
      {outras.length > 0 && <EscolhaDeOrganizacao vinculos={outras} rotulo="Você também participa de" />}
    </MolduraDeConta>
  );
}
