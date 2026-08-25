import { z } from "zod";

import { ICONE_PADRAO, TIPOS_DE_AREA } from "@/dominio/organizacao";

/**
 * Os quatro corpos de escrita da configuração — `POST`/`PATCH` de `categorias` e de `areas`
 * (contrato §8.1).
 *
 * **A lista de ícones mora aqui, e a decisão é da §14.5 do `modelo-de-dados.md`:** o banco guarda a
 * *forma* — `CHECK (icone ~ '^[a-z0-9-]{1,40}$')` —, a *lista* mora no schema de validação da Interface.
 * Pôr a lista no banco criaria três cópias da mesma decisão de produto, porque o cliente **não consegue
 * renderizar uma string**: `lucide-react` exporta componentes, então um mapa nome → componente é
 * inevitável nesta camada.
 *
 * **Nada aqui aplica padrão.** `icone` ausente e `ordem` ausente sobem ausentes; quem decide o que
 * acontece quando ninguém manda é a **Aplicação**, pela mesma doutrina que `aplicacao/organizacao/
 * consultas.ts` escreveu para o *"só as ativas"*: padrão de produto não é convenção de HTTP.
 */

/**
 * **Os 25 ícones da §14.5, na ordem em que ela os agrupa** — nome do conjunto `lucide` e rótulo em
 * português, no **mesmo registro**.
 *
 * **O rótulo mora aqui e não num segundo arranjo**, porque dois arranjos paralelos divergem na primeira
 * alteração. Da mesma constante saem os **três usos gerados** que a §14.5 nomeia: o `enum` do Zod logo
 * abaixo, o mapa nome → componente de `interface/componentes/icone-de-categoria.tsx`, e o teste da
 * esteira.
 *
 * **O rótulo nomeia o desenho, nunca a categoria** — `droplets` é *Gotas*, não *Vazamentos*. São nomes de
 * figura e **não entram no glossário**: o vocabulário de domínio é o `nome` da `Categoria`, que o Gestor
 * digita.
 *
 * Ampliar é acrescentar um par aqui — **não é migração**, e é isso que a decisão da §14.5 comprou.
 */
export const ICONES_DE_CATEGORIA = [
  // Das sete sementes (§14.1)
  { nome: "lightbulb", rotulo: "Lâmpada" },
  { nome: "unplug", rotulo: "Tomada" },
  { nome: "accessibility", rotulo: "Acessibilidade" },
  { nome: "trash-2", rotulo: "Lixeira" },
  { nome: "droplets", rotulo: "Gotas" },
  { nome: "shield", rotulo: "Escudo" },
  { nome: "wrench", rotulo: "Chave inglesa" },
  // Instalações
  { nome: "zap", rotulo: "Raio" },
  { nome: "flame", rotulo: "Chama" },
  { nome: "thermometer", rotulo: "Termômetro" },
  { nome: "wind", rotulo: "Vento" },
  { nome: "snowflake", rotulo: "Floco de neve" },
  // Acesso e segurança
  { nome: "door-open", rotulo: "Porta aberta" },
  { nome: "key", rotulo: "Chave" },
  { nome: "camera", rotulo: "Câmera" },
  { nome: "wifi", rotulo: "Wi-Fi" },
  { nome: "package", rotulo: "Encomenda" },
  // Convivência
  { nome: "car", rotulo: "Carro" },
  { nome: "dog", rotulo: "Cachorro" },
  { nome: "bug", rotulo: "Inseto" },
  { nome: "trees", rotulo: "Árvores" },
  { nome: "volume-2", rotulo: "Som" },
  // Obra e conservação
  { nome: "hammer", rotulo: "Martelo" },
  { nome: "paintbrush", rotulo: "Pincel" },
  // Neutro — o padrão, que mora no Domínio e é repetido aqui **como membro da lista**, não como valor
  { nome: ICONE_PADRAO, rotulo: "Etiqueta" },
] as const;

/** A união dos 25 literais. É o tipo que a guarda do teste impede de alargar para `string`. */
export type NomeDeIcone = (typeof ICONES_DE_CATEGORIA)[number]["nome"];

/**
 * **Gerado da constante, e é isso que impede a lista de existir duas vezes.**
 *
 * O `z.enum` da versão instalada aceita `readonly string[]` e infere a união de `T[number]` — o `.map`
 * perde a tupla e **preserva os literais**, que é o que o tipo `NomeDeIcone` precisa.
 */
const NOMES_DE_ICONE = ICONES_DE_CATEGORIA.map((icone) => icone.nome);

/** Nome fora da lista → `400 FORMATO_INVALIDO`, porque é **forma** e não domínio (contrato §8.1). */
export const iconeDeCategoria = z.enum(NOMES_DE_ICONE, {
  error: "Escolha um ícone da lista.",
});

/** Até 60, como a coluna `varchar(60)` de `categorias.nome` (modelo §6.5). */
const nomeDeCategoria = z
  .string()
  .trim()
  .min(1, "Informe o nome da categoria.")
  .max(60, "O nome cabe em 60 caracteres.");

/** Até 80, como a coluna `varchar(80)` de `areas.nome` (modelo §6.6). */
const nomeDeArea = z
  .string()
  .trim()
  .min(1, "Informe o nome da área.")
  .max(80, "O nome cabe em 80 caracteres.");

/** `smallint` com o teto do contrato. Quem escolhe a ordem é o Gestor (D18). */
const ordem = z.int().min(0, "A ordem começa em 0.").max(999, "A ordem vai até 999.");

/**
 * **`tipo` é obrigatório e não tem padrão.** Um padrão implícito escolheria a visibilidade da ocorrência
 * em silêncio — que é exatamente o que a D10 recusa ao dizer que a visibilidade é *derivação, não
 * configuração*.
 */
const tipoDeArea = z.enum(TIPOS_DE_AREA, { error: "Escolha o tipo da área." });

export const criacaoDeCategoriaSchema = z.object({
  nome: nomeDeCategoria,
  icone: iconeDeCategoria.optional(),
  ordem: ordem.optional(),
});

export const correcaoDeCategoriaSchema = z.object({
  nome: nomeDeCategoria.optional(),
  icone: iconeDeCategoria.optional(),
  ordem: ordem.optional(),
  ativa: z.boolean().optional(),
});

export const criacaoDeAreaSchema = z.object({
  nome: nomeDeArea,
  tipo: tipoDeArea,
  ordem: ordem.optional(),
});

export const correcaoDeAreaSchema = z.object({
  nome: nomeDeArea.optional(),
  tipo: tipoDeArea.optional(),
  ordem: ordem.optional(),
  ativa: z.boolean().optional(),
});

export type EntradaDeCriacaoDeCategoria = z.infer<typeof criacaoDeCategoriaSchema>;
export type EntradaDeCorrecaoDeCategoria = z.infer<typeof correcaoDeCategoriaSchema>;
export type EntradaDeCriacaoDeArea = z.infer<typeof criacaoDeAreaSchema>;
export type EntradaDeCorrecaoDeArea = z.infer<typeof correcaoDeAreaSchema>;
