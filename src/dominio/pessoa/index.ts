/**
 * Superfície pública de `dominio/pessoa`.
 *
 * **`Pessoa` é um dos seis agregados** da `arquitetura.md` §2 — global, sobrevive à revogação do vínculo e
 * existe sem vínculo nenhum. Este módulo começa pelo que o item 7a exige: o telefone que vira contato.
 */
export { ehE164, paraE164Brasileiro } from "./Telefone";
