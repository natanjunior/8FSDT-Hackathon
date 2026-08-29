/** Os três campos, como o banco os devolve — e como o comando os monta. */
export type DadosDeAvaliacao = {
  /** Inteiro de 1 a 5. A escala é decisão de domínio (S3, D1), e esta classe é a dona dela. */
  nota: number;
  /** Já normalizado: `""` e `"   "` viraram `null` no comando de aplicação, num lugar só. */
  comentario: string | null;
  /** ISO 8601. **O agregado não lê relógio** — quem chama informa o instante, como em
   *  `RegistroDeTransicao`. É o MESMO instante que carimba `atualizada_em`, e o
   *  `CHECK (avaliada_em >= registrada_em)` transforma dois relógios em erro de banco. */
  avaliadaEm: string;
};

/**
 * ============================================================================
 *  `Avaliacao` — o TERCEIRO objeto de valor dentro do limite do agregado
 * ============================================================================
 *
 * **Ela mora em `ocorrencias`, não em tabela própria**, e a decisão é do `modelo-de-dados.md:1246`:
 * *"objeto de valor `0..1` dentro do limite do agregado"*. A tabela `avaliacoes` foi **recusada** por
 * precisar de *trigger* para checar o `status` de outra tabela (`:1267`) — só aqui `status` está na mesma
 * linha, e é o que torna a **invariante 8** verificável pelo banco.
 *
 * **Classe, e não um `type` de três campos**, e o argumento é o irmão: `RegistroDeTransicao` e
 * `AnexoDaOcorrencia` são os outros dois objetos de valor deste mesmo agregado, e os dois são classes com
 * fábrica e guarda. Um `type` solto seria o único dos três **sem porta** — e a escala de 1 a 5 ficaria
 * escrita só em dois lugares que não são o Domínio: o `CHECK` do banco e o schema do Zod.
 *
 * **`registrada` guarda; `reconstituir` NÃO.** É o idioma de `RegistroDeTransicao`: quem confere é a
 * fábrica de criação, nunca a de volta do banco. Ver o caso de teste, que escreve o porquê.
 *
 * **Sem um único `import`** — é o primeiro arquivo deste módulo de que isso é verdade, e é o que mostra
 * quão pouco a avaliação depende do resto do agregado.
 */
export class Avaliacao {
  private constructor(
    readonly nota: number,
    readonly comentario: string | null,
    readonly avaliadaEm: string,
  ) {
    Object.freeze(this);
  }

  /**
   * A avaliação **nova** — a que o comando `avaliar` cria.
   *
   * **A guarda é `Error`, e não `ErroDeDominio`**, pelo argumento das oito guardas anteriores do
   * agregado: alcançá-la significa que a Interface deixou passar um valor que `avaliacaoSchema` recusa
   * com `400`. Defeito nosso, não recusa de negócio — e o produto tem o `400` um nível acima.
   *
   * **`Number.isInteger` vem PRIMEIRO**, e não é ordem por gosto: `NaN >= 1` é `false` e
   * `4.5 >= 1 && 4.5 <= 5` é `true`, então a comparação sozinha deixaria o meio-ponto passar e daria a
   * mensagem errada para `NaN`.
   */
  static registrada(dados: DadosDeAvaliacao): Avaliacao {
    if (!Number.isInteger(dados.nota)) {
      throw new Error(`A nota da avaliação é inteira; recebida '${String(dados.nota)}'.`);
    }
    if (dados.nota < 1 || dados.nota > 5) {
      throw new Error(`A nota da avaliação fica entre 1 e 5; recebida ${dados.nota}.`);
    }

    return new Avaliacao(dados.nota, dados.comentario, dados.avaliadaEm);
  }

  /** A volta do banco. **Não confere nada** — ver o cabeçalho. */
  static reconstituir(dados: DadosDeAvaliacao): Avaliacao {
    return new Avaliacao(dados.nota, dados.comentario, dados.avaliadaEm);
  }
}
