import { Ocorrencia } from "@/dominio/ocorrencia";

import { AreaInvalida, CategoriaInvalida } from "./erros";
import type { OcorrenciaLida, PortasDoRegistro } from "./portas";

export type EntradaDeRegistro = {
  titulo: string;
  descricao: string;
  categoriaId: string;
  areaId: string;
  localizacaoComplemento?: string | null;
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
  ctx: { pessoaId: string; agora?: string },
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
    ocorreuEm: ctx.agora ?? new Date().toISOString(),
  });

  return portas.ocorrencias.registrar(agregado);
}
