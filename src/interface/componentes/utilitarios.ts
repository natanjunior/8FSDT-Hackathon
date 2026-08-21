import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes utilitárias resolvendo conflitos — o `cn` que o `shadcn/ui` espera encontrar.
 *
 * Vive em `interface/componentes/` porque é infraestrutura de estilo, não de dados: a ADR-0007 escolheu
 * Tailwind justamente para que *"estilo declarado no próprio componente elimine a folha de estilo global
 * como lugar onde regras colidem"*, e esta função é o que torna isso composável.
 */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
