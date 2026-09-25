import { CELULA, ROTULO_DE_COLUNA } from "@/interface/componentes/pecas-da-tabela";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/interface/componentes/ui/table";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  A tabela do `Ver dados` de T-07
 * ============================================================================
 *
 * **É a alternativa textual do gráfico** (item 73, critério 12): o desenho é `aria-hidden`, e é aqui que
 * o número de cada mês ou faixa existe para quem não vê. Por isso ela tem `caption` com o período, o
 * cabeçalho com `scope="col"` e a primeira célula de cada linha com `scope="row"`.
 *
 * **As peças são as do catálogo, e a cadeia de classes é a de `pecas-da-tabela.ts`**, a mesma das outras
 * tabelas do produto. Os números alinham à direita, em `tabular-nums`, para a coluna se ler de cima a
 * baixo.
 */
export function TabelaDeDados({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string;
  colunas: readonly string[];
  linhas: readonly { chave: string; celulas: readonly string[] }[];
}) {
  return (
    <Table>
      <TableCaption className="text-meta text-tinta-suave mt-3">{legenda}</TableCaption>
      <TableHeader>
        <TableRow>
          {colunas.map((coluna, i) => (
            <TableHead
              key={coluna}
              scope="col"
              className={cn(ROTULO_DE_COLUNA, i > 0 && "text-right")}
            >
              {coluna}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha) => (
          <TableRow key={linha.chave}>
            {linha.celulas.map((celula, i) =>
              i === 0 ? (
                <TableHead
                  key={i}
                  scope="row"
                  className={cn(CELULA, "text-tinta bg-transparent font-normal")}
                >
                  {celula}
                </TableHead>
              ) : (
                <TableCell key={i} className={cn(CELULA, "text-tinta text-right tabular-nums")}>
                  {celula}
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
