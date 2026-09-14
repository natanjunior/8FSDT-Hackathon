"use client";

import { Button } from "@/interface/componentes/ui/button";

import { useNavegacaoDaLista } from "./navegacao-da-lista";

/**
 * ============================================================================
 *  A deriva do conjunto desde o corte — critério 44c.6
 * ============================================================================
 *
 * **A frase nomeia o INSTANTE, e nunca o gesto de abrir.** O endereço carrega `ate`, então a lista que
 * alguém recebe por mensagem foi cortada por outra pessoa, em outra hora: *"desde que você abriu"* é
 * falso para quem recebeu. É o guia §8, e é a razão de este componente existir separado.
 *
 * **A hora chega pronta do servidor.** Formatar aqui usaria o fuso do navegador, e o mesmo endereço
 * mostraria horas diferentes em aparelhos diferentes. É a mesma disciplina de `instanteDoServidor`.
 *
 * **[Atualizar] refaz o pedido sem `ate` e sem `totalNoCorte`, e mantém o filtro e a página.** Se a
 * página tiver deixado de existir no corte novo, quem responde é o quarto estado, que existe para isso.
 */
export function DerivaDaLista({
  consultaAtual,
  ate,
  hora,
  saidas,
  novas,
}: {
  consultaAtual: string;
  /** O instante do corte, legível por máquina. */
  ate: string;
  /** O mesmo instante, legível por gente, formatado no servidor. */
  hora: string;
  saidas: number;
  novas: number;
}) {
  const { navegar } = useNavegacaoDaLista();

  if (saidas === 0 && novas === 0) return null;

  function atualizar(): void {
    // `pagina` fica. Só o corte é refeito — é o que a frase promete.
    const proximos = new URLSearchParams(consultaAtual);
    proximos.delete("ate");
    proximos.delete("totalNoCorte");
    navegar(proximos);
  }

  return (
    <p
      role="status"
      className="text-meta text-tinta-suave flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span>
        Esta lista é o retrato de{" "}
        <time dateTime={ate} className="text-tinta font-mono">
          {hora}
        </time>
        .
      </span>
      {saidas > 0 && (
        <span>
          {saidas} {saidas === 1 ? "saiu" : "saíram"}
        </span>
      )}
      {saidas > 0 && novas > 0 && <span aria-hidden>·</span>}
      {novas > 0 && (
        <span>
          {novas} {novas === 1 ? "chegou" : "chegaram"} desde então
        </span>
      )}
      <Button
        type="button"
        variant="link"
        onClick={atualizar}
        className="text-marca text-meta min-h-11 px-0 underline underline-offset-4"
      >
        Atualizar
      </Button>
    </p>
  );
}
