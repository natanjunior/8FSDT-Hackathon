import { FRASE_ABRINDO } from "@/interface/trabalhador/constantes";

/**
 * **As duas frases de espera, num lugar só** (item 126, critério 5). A porta diz o nome do produto; dentro
 * dele, a espera só diz que está carregando. Nenhuma das duas fala da hospedagem (padrão P9 do guia).
 */
export const FRASES_DE_ESPERA = {
  /**
   * `app/loading.tsx` e `app/entrar/loading.tsx`: quem ainda não está no produto. É a frase da casca do
   * trabalhador de serviço (item 98), que mora em `constantes.ts` porque aquele arquivo não importa nada;
   * assim a porta abre com uma frase só, com ou sem rede.
   */
  porta: FRASE_ABRINDO,
  /** As outras dezessete esperas. */
  dentro: "Carregando…",
} as const;
