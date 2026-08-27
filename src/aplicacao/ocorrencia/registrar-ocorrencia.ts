import { AnexoJaReivindicado } from "@/aplicacao/anexo";
import { Ocorrencia, type DadosDeAnexo } from "@/dominio/ocorrencia";

import { AreaInvalida, CategoriaInvalida } from "./erros";
import type { OcorrenciaLida, PortasDoRegistro } from "./portas";
import { reivindicarAnexo, type ReferenciaDeAnexo } from "./reivindicar-anexo";

export type EntradaDeRegistro = {
  titulo: string;
  descricao: string;
  categoriaId: string;
  areaId: string;
  localizacaoComplemento?: string | null;
  /** `maxItems: 1` é do schema de entrada; aqui a lista é a forma permanente. */
  anexos?: readonly ReferenciaDeAnexo[] | null;
};

/**
 * ============================================================================
 *  `registrar` — o comando, e o que ele coordena
 * ============================================================================
 *
 * **Função, não objeto de caso de uso** (`arquitetura.md` §5.4). Recebe as portas como argumento; não
 * constrói infraestrutura e não tem o que importar (ADR-0005).
 *
 * **Por que a Área é lida aqui e não no repositório.** `areaTipo` é decisão de domínio — a visibilidade
 * congelada da §7.5 —, e o comando é a camada que coordena vários objetos (CA aula 3, p.8–9). O
 * repositório recebe o tipo **já resolvido** e apenas insere.
 *
 * **A janela entre ler e gravar é inofensiva, e vale dizer por quê.** Se o Gestor desativar a Área entre
 * a leitura e o `insert`, a ocorrência nasce apontando para uma Área desativada — que é um estado
 * **legal** do produto: o critério 4a.2 diz que desativar *"não apaga"* e que *"as ocorrências já
 * registradas continuam apontando para ela"*. O resultado da corrida é indistinguível de um registro
 * feito um segundo antes. A existência e o pertencimento à organização continuam garantidos pelas FKs
 * compostas, que são checadas dentro da transação.
 */
export async function registrarOcorrencia(
  portas: PortasDoRegistro,
  ctx: { pessoaId: string; organizacaoId: string; agora?: string },
  entrada: EntradaDeRegistro,
): Promise<OcorrenciaLida> {
  // **Só as ativas**, que é o padrão de T-04 (contrato §8.1). A recusa é a mesma para inexistente e para
  // desativada — quem separa os dois casos vaza a existência (§6.3).
  const [categorias, areas] = await Promise.all([
    portas.categorias.listar({ apenasAtivas: true }),
    portas.areas.listar({ apenasAtivas: true }),
  ]);

  // **`ativa` e conferida aqui, e nao so pelo `apenasAtivas`.** O filtro e do repositorio; a **regra** e
  // desta camada, e e ela que o teste com duplo exerce — um duplo nao implementa `where ativa`. As duas
  // guardas juntas dao a mesma recusa para inexistente, de outra organizacao e desativada (§6.3).
  const categoria = categorias.find((candidata) => candidata.id === entrada.categoriaId);
  if (categoria === undefined || !categoria.ativa) throw new CategoriaInvalida();

  const area = areas.find((candidata) => candidata.id === entrada.areaId);
  if (area === undefined || !area.ativa) throw new AreaInvalida();

  const complemento = entrada.localizacaoComplemento?.trim();

  // **O relógio é lido UMA vez**, e o mesmo instante carimba a ocorrência, o primeiro registro da trilha
  // e o anexo. Três leituras diferentes de `Date.now()` produziriam um anexo anterior à própria
  // ocorrência por milissegundos — e o modelo §6.16 declara que a ordem entre os dois é garantida pela
  // transação, não por um `CHECK`.
  const agora = ctx.agora ?? new Date().toISOString();

  /**
   * **A reivindicação roda AQUI, e a ordem é decisão.**
   *
   * Ela vem **depois** de categoria e área porque trocar a etiqueta para `confirmado` num pedido que vai
   * levar `422 CATEGORIA_INVALIDA` produziria, de graça, o objeto órfão-confirmado que a §10.3 do
   * contrato declara irrecuperável. E vem **antes** de a transação abrir, porque conversar com o storage
   * dentro de um `BEGIN` seguraria uma conexão do pool pelo tempo de duas idas e voltas de rede.
   *
   * **Laço sequencial e não `Promise.all`, de propósito:** hoje `maxItems: 1` garante um elemento, e no
   * dia do segundo anexo reivindicar em paralelo faria duas falhas concorrerem para decidir qual erro
   * sobe. O laço mantém a primeira recusa sendo a que responde.
   */
  const anexos: DadosDeAnexo[] = [];
  for (const referencia of entrada.anexos ?? []) {
    anexos.push(
      await reivindicarAnexo(
        portas.armazenamento,
        { organizacaoId: ctx.organizacaoId, pessoaId: ctx.pessoaId, agora },
        referencia,
      ),
    );
  }

  /**
   * **O agregado é a porta, e é aqui que ele é atravessado.**
   *
   * `status: "aberta"`, `prioridade: "normal"` e o **primeiro registro da trilha** saem daqui — de
   * `Ocorrencia.registrar` —, não do `default` do banco e não deste arquivo. Os `default` da migração
   * existem como rede, não como escritor: se o comando não passasse pelo agregado, a invariante 1
   * valeria por disciplina em vez de por estrutura, que é exatamente o que a ADR-0001 recusa.
   */
  const agregado = Ocorrencia.registrar({
    titulo: entrada.titulo.trim(),
    descricao: entrada.descricao.trim(),
    categoriaId: entrada.categoriaId,
    areaId: entrada.areaId,
    // A cópia congelada. Lida agora, gravada uma vez, **nunca atualizada**.
    areaTipo: area.tipo,
    localizacaoComplemento: complemento === undefined || complemento === "" ? null : complemento,
    // **O autor é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema de entrada.
    autorPessoaId: ctx.pessoaId,
    // O agregado não lê relógio — isso o torna testável sem congelar o tempo. Quem informa o instante é
    // este comando; o banco carimba `ocorreu_em` com o mesmo valor.
    ocorreuEm: agora,
    anexos,
  });

  const resultado = await portas.ocorrencias.registrar(agregado);

  // **A segunda porta de entrada do `409`.** A primeira é a corrida entre dois reenvios simultâneos, que
  // passam os dois pela conferência 5 e chegam juntos ao `INSERT`; a segunda é o reenvio da S-T7. As
  // duas chegam aqui como o mesmo desfecho, e é o `UNIQUE (chave)` que as separa do caminho feliz.
  if (resultado.desfecho === "anexo-ja-reivindicado") {
    throw new AnexoJaReivindicado(resultado.ocorrenciaId);
  }

  return resultado.ocorrencia;
}
