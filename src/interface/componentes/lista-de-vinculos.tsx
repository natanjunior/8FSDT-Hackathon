"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { casaPeloNome, termosDaBusca } from "@/interface/componentes/busca-de-candidatos";
import type { ImpedimentoNaTela } from "@/interface/componentes/frases-da-remocao";
import { RemocaoDeVinculo } from "@/interface/componentes/remocao-de-vinculo";
import { Input } from "@/interface/componentes/ui/input";
import type { VinculoProjetado } from "@/interface/projecoes";

/**
 * **T-08 · a lista de quem já está na organização.**
 *
 * **`Unidade` é coluna própria, nunca embutida no nome**, e a razão não é estética: o `nome` vai para a
 * trilha de auditoria, que é **imutável**; a unidade pertence ao vínculo e pode mudar. Embutir uma no
 * outro é congelar um fato mutável dentro de um imutável — que é o que os exemplos antigos do contrato
 * faziam ao chamar alguém de *"Morador do 302"*.
 *
 * **`temConta` não é detalhe técnico**, e é apresentado como informação, não como defeito: `false` é o
 * Encarregado que *"existe como cadastro, recebe atribuições e aparece como responsável"*. É a informação
 * que explica por que o zelador nunca move nada no sistema.
 *
 * **`temWhatsapp` aparece como palavra**, nunca como marca colorida (compromisso A-5). Um ícone verde sem
 * texto some para quem não distingue as duas cores.
 *
 * **A listagem mostra o primeiro contato e a contagem do resto**, e o resto abre na própria linha: quatro
 * contatos por pessoa empurrariam a linha para três alturas, e a pergunta desta tela é *"quem está aqui"*,
 * não *"como alcanço esta pessoa"*.
 *
 * **O vazio da LISTA não existe, e é decisão:** toda organização tem ao menos o Gestor que a criou (D26),
 * e o `409 ULTIMO_GESTOR` — que o item 10 põe de pé — garante que ele não pode se remover. Lista vazia
 * aqui é defeito, e uma frase simpática ensinaria que o caso é normal.
 *
 * **O vazio da BUSCA existe e tem frase própria** (critério 10.6): *"Ninguém com esse nome."* — as mesmas
 * palavras do modal do item 20, porque é o mesmo evento. Não colide com nada, justamente porque a lista
 * não tem vazio com que colidir.
 *
 * **A coluna `Remover` fica à direita de `Corrigir`, e ela é botão-ou-razão** (item 10): quando o
 * vínculo não pode sair, **a razão ocupa o lugar do botão** — nunca uma mensagem de erro depois do
 * clique. Quem decide é `impedimentosDeRemocao`, que a página lê pela estrada direta.
 */
/**
 * **Busca em branco devolve a lista inteira, na mesma ordem** — a de `order by p.nome` do repositório.
 * Filtrar nunca reordena.
 *
 * **Reuso literal, sem cópia:** `termosDaBusca` e `casaPeloNome` são do item 20 e recebem `string`, não
 * `Candidato`. É o que o critério 10.6 nomeia, e o que o módulo foi escrito para permitir.
 */
export function filtrarVinculosPorNome(
  vinculos: readonly VinculoProjetado[],
  busca: string,
): readonly VinculoProjetado[] {
  const termos = termosDaBusca(busca);
  if (termos.length === 0) return vinculos;

  return vinculos.filter((vinculo) => casaPeloNome(vinculo.pessoa.nome, termos));
}

export function ListaDeVinculos({
  vinculos,
  impedimentos,
  organizacaoId,
  euPessoaId,
}: {
  vinculos: readonly VinculoProjetado[];
  /** Por `pessoaId`. **Chave ausente é *pode sair*** — e é a única forma de dizer isso. */
  impedimentos: Readonly<Record<string, ImpedimentoNaTela>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** Quem está olhando. O aviso de auto-remoção da spec §3.8 depende disto. */
  euPessoaId: string;
}) {
  const campoDeBuscaId = useId();
  const [busca, setBusca] = useState("");
  const visiveis = filtrarVinculosPorNome(vinculos, busca);
  const buscando = termosDaBusca(busca).length > 0;

  return (
    <section className="flex flex-col gap-3">
      {/* **O contador não mente.** O cabeçalho continua com o TOTAL; trocá-lo pelo filtrado é literalmente
          o *"faz o Gestor pensar que perdeu dados"* que o produto persegue desde T-03. */}
      <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">
        Vínculos ativos ({vinculos.length})
        <span className="text-tinta-fraca ml-2 font-normal normal-case">
          {buscando
            ? `${String(visiveis.length)} de ${String(vinculos.length)} · ordenados por nome`
            : "ordenados por nome"}
        </span>
      </h2>

      {/* **A-1:** rótulo visível e associado. `placeholder` nunca é rótulo — se o texto some ao digitar,
          está errado. **Sempre visível**, como no modal do item 20: um campo que só aparecesse acima de N
          pessoas daria duas formas à mesma tela. **Sem foco automático** — a tela abre para *ler quem
          está aqui*, não para procurar.

          **Dentro do bloco de vínculos, e nunca acima dele:** o campo encosta no que filtra, e a busca não
          alcança os pedidos de entrada. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={campoDeBuscaId} className="text-tinta text-sm font-medium">
          Buscar pelo nome
        </label>
        <Input
          id={campoDeBuscaId}
          type="search"
          inputMode="search"
          autoComplete="off"
          /* O teto da coluna e do schema (`schemas/vinculo.ts`), para que um nome inteiro caiba. */
          maxLength={120}
          value={busca}
          onChange={(evento) => setBusca(evento.currentTarget.value)}
          /* **A-3:** o catálogo entrega `h-9`; esta tela sobe para ~44 px. */
          className="h-11 md:max-w-sm"
        />
      </div>

      {/* Celular: cartões. A tabela de seis colunas em 390 px viraria rolagem lateral, e esta tela é
          declarada "tela grande" — o inventário não a desenha no celular, e o desenho é desta spec. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {visiveis.map((vinculo) => (
          <li
            key={vinculo.pessoa.pessoaId}
            className="border-linha flex flex-col gap-2 rounded-md border px-3 py-3"
          >
            <p className="text-tinta text-sm font-semibold">{vinculo.pessoa.nome}</p>
            <Campo rotulo="Papel">{rotuloDoPapel(vinculo.papel)}</Campo>
            <Campo rotulo="Unidade">{vinculo.area?.nome ?? "—"}</Campo>
            <Campo rotulo="Conta">{vinculo.temConta ? "Tem conta" : "Sem conta"}</Campo>
            <Campo rotulo="Contatos">
              <Contatos vinculo={vinculo} />
            </Campo>
            <Campo rotulo="Desde">{emData(vinculo.criadoEm)}</Campo>
            <Corrigir vinculo={vinculo} />
            <RemocaoDeVinculo
              pessoaId={vinculo.pessoa.pessoaId}
              nome={vinculo.pessoa.nome}
              temConta={vinculo.temConta}
              impedimento={impedimentos[vinculo.pessoa.pessoaId] ?? null}
              organizacaoId={organizacaoId}
              ehMeuProprioVinculo={vinculo.pessoa.pessoaId === euPessoaId}
            />
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-tinta-suave border-linha border-b">
              <th scope="col" className="py-2 pr-3 font-medium">
                Pessoa
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Papel
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Unidade
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Conta
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Contatos
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Desde
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Corrigir
              </th>
              <th scope="col" className="py-2 font-medium">
                Remover
              </th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((vinculo) => (
              <tr key={vinculo.pessoa.pessoaId} className="border-linha-suave border-b align-top">
                <td className="text-tinta py-3 pr-3">{vinculo.pessoa.nome}</td>
                <td className="py-3 pr-3">{rotuloDoPapel(vinculo.papel)}</td>
                <td className="py-3 pr-3">{vinculo.area?.nome ?? "—"}</td>
                <td className="py-3 pr-3">{vinculo.temConta ? "Tem conta" : "Sem conta"}</td>
                <td className="py-3 pr-3">
                  <Contatos vinculo={vinculo} />
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">{emData(vinculo.criadoEm)}</td>
                <td className="py-3 pr-3">
                  <Corrigir vinculo={vinculo} />
                </td>
                <td className="py-3">
                  <RemocaoDeVinculo
                    pessoaId={vinculo.pessoa.pessoaId}
                    nome={vinculo.pessoa.nome}
                    temConta={vinculo.temConta}
                    impedimento={impedimentos[vinculo.pessoa.pessoaId] ?? null}
                    organizacaoId={organizacaoId}
                    ehMeuProprioVinculo={vinculo.pessoa.pessoaId === euPessoaId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* **As mesmas palavras do modal do item 20**, e é deliberado: é o mesmo evento — *procurei e não
          achei* —, e duas frases diferentes para o mesmo fato são duas coisas para manter.

          **Não colide com o vazio da lista**, porque essa lista **não tem** vazio: toda organização tem ao
          menos o Gestor que a criou (D26), e o `409 ULTIMO_GESTOR` — que este item põe de pé — garante que
          ele não pode se remover. Lista vazia aqui é defeito.

          **Texto simples, não região viva:** um `role="status"` que fala a cada tecla é ruído para quem
          usa leitor de tela, e a lista está imediatamente abaixo do campo. */}
      {buscando && visiveis.length === 0 && (
        <p className="text-tinta-suave text-sm">Ninguém com esse nome.</p>
      )}
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <p className="text-tinta-suave text-sm">
      <span className="text-tinta-fraca">{rotulo}: </span>
      {children}
    </p>
  );
}

/**
 * O primeiro contato e a contagem do resto. **`ordem` é o significado**: o contato 1 é para onde se liga
 * primeiro, e a lista **é** a cadeia de tentativa — não há caixa de *"contato preferido"*.
 */
function Contatos({ vinculo }: { vinculo: VinculoProjetado }) {
  const [primeiro, ...resto] = vinculo.pessoa.contatos;
  if (primeiro === undefined) return <span className="text-tinta-fraca">—</span>;

  return (
    <>
      <span className="text-tinta-suave">1 · {descrever(primeiro)}</span>
      {resto.length > 0 && (
        <details className="mt-1">
          <summary className="text-marca min-h-11 cursor-pointer text-sm underline underline-offset-4">
            mais {resto.length} {resto.length === 1 ? "contato" : "contatos"}
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {resto.map((contato, indice) => (
              <li key={contato.id} className="text-tinta-suave text-sm">
                {indice + 2} · {descrever(contato)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** *"+55 11 95521-7788 — telefone trabalho · Aceita WhatsApp"* — o E.164 agrupado, sem inventar formato. */
function descrever(contato: VinculoProjetado["pessoa"]["contatos"][number]): string {
  const partes = [`${contato.valor} — ${contato.tipo} ${contato.finalidade}`];
  // A-5: WhatsApp **em palavra**, nunca só em cor.
  if (contato.temWhatsapp) partes.push("Aceita WhatsApp");
  if (contato.observacao !== null) partes.push(contato.observacao);
  return partes.join(" · ");
}

/**
 * **O chip aparece para todo vínculo, não só para quem não tem conta** (spec §2.1). A guarda do contrato
 * nomeia campos: `nome` é da `Pessoa`, que é global; `areaId` é do `Vínculo`, e o Gestor tem legitimidade
 * para dizer em qual unidade a pessoa mora **aqui**. Esconder o chip de quem tem conta fecharia pela tela
 * a única porta que resta para a unidade de um morador.
 */
function Corrigir({ vinculo }: { vinculo: VinculoProjetado }) {
  return (
    <Link
      href={`/vinculos/${vinculo.pessoa.pessoaId}/editar`}
      className="text-marca inline-flex min-h-11 items-center text-sm underline underline-offset-4"
    >
      Corrigir
      <span className="sr-only"> os dados de {vinculo.pessoa.nome}</span>
    </Link>
  );
}

function rotuloDoPapel(papel: string): string {
  if (papel === "gestor") return "Gestor";
  if (papel === "encarregado") return "Encarregado";
  return "Solicitante";
}

function emData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
