import { semear, type ResumoDaSemeadura } from "./mundo";
import { PERFIL_DA_DEMONSTRACAO, PERFIL_DE_TESTE, planoDaDemonstracao, reconhecimentoDo } from "./plano";
import {
  apagarADemonstracao,
  hostDoBanco,
  organizacoesDaDemonstracao,
  type OrganizacaoEncontrada,
} from "./remocao";

/**
 * ============================================================================
 *  `npm run semear:demo` — e `npm run semear:demo -- --apagar`
 * ============================================================================
 *
 * **`--teste` troca o mundo e nada mais.** Semeia (ou, com `--apagar`, apaga) o gêmeo que só os testes de
 * ponta a ponta usam: o mesmo plano, com outras organizações e outras contas (item 63). A recusa, a
 * remoção e o resumo são os mesmos para os dois.
 *
 * **Operação manual, uma vez por ambiente.** Ela não entra em pipeline nenhum: um passo que semeia dado
 * de demonstração a cada push é como se perde o controle do que existe no banco publicado (spec §5).
 */

const LARGURA_DO_NOME = 42;
const LARGURA_DO_CODIGO = 14;

const perfil = process.argv.includes("--teste") ? PERFIL_DE_TESTE : PERFIL_DA_DEMONSTRACAO;
// Os de hoje e os anteriores (item 77): a recusa e o `--apagar` reconhecem o mundo pelos dois.
const { nomes, emails } = reconhecimentoDo(perfil);
/** O rótulo como sujeito da frase: "A demonstração", "O mundo de teste". */
const ROTULO = perfil.rotulo.charAt(0).toUpperCase() + perfil.rotulo.slice(1);
const APAGAR =
  perfil === PERFIL_DE_TESTE ? "npm run semear:demo -- --teste --apagar" : "npm run semear:demo -- --apagar";

async function principal(): Promise<number> {
  if (process.argv.includes("--apagar")) {
    // **A primeira linha é o banco.** Um `BANCO_URL` errado no shell aparece antes de qualquer `delete`.
    console.log(`Banco: ${hostDoBanco(process.env.BANCO_URL)}`);

    const { organizacoes, pessoas, homonimas } = await apagarADemonstracao(emails, nomes);
    console.log(
      organizacoes === 0
        ? `${ROTULO} não tem organização neste banco. Nada a apagar.`
        : `Apagadas ${String(organizacoes)} organizações e ${String(pessoas)} pessoas sem conta. ` +
            "As duas contas de acesso continuam existindo, e a próxima semeadura as reaproveita.",
    );
    if (homonimas.length > 0) {
      console.log(
        `Ficaram de fora, porque têm um nome de ${perfil.rotulo} e não foram fundadas pelas contas desse mundo:\n` +
          listar(homonimas),
      );
    }
    return 0;
  }

  const senha = process.env.SENHA_DA_DEMONSTRACAO;
  if (senha === undefined || senha.trim() === "") {
    console.error(
      "SENHA_DA_DEMONSTRACAO não está definida, e ela não tem padrão.\n" +
        "  Local:     escreva a variável no .env.local, ou passe-a no comando.\n" +
        "  Publicado: exporte-a no shell antes de rodar.\n" +
        "A senha é publicada no README junto dos dois e-mails — trocá-la é uma variável de ambiente e " +
        "uma linha de documentação, nunca uma mudança de código (spec §3.11).",
    );
    return 1;
  }

  // **A recusa vem ANTES de qualquer escrita.** É o que impede a terceira e a quarta organização de
  // demonstração de nascerem numa execução distraída (critério 43.5).
  const { daDemonstracao, homonimas } = await organizacoesDaDemonstracao(emails, nomes);

  // **O homônimo recusa primeiro**, porque o `--apagar` não o resolve: ele não é da demonstração.
  if (homonimas.length > 0) {
    console.error(
      `Há organização com um nome de ${perfil.rotulo} que não foi fundada pelas contas desse mundo:\n` +
        listar(homonimas) +
        "\nA semente não escreve ao lado de um homônimo, e o `--apagar` não o apaga. " +
        "Resolva essa organização por fora e rode de novo.",
    );
    return 1;
  }

  if (daDemonstracao.length > 0) {
    console.error(
      `${ROTULO} já existe neste banco:\n` +
        listar(daDemonstracao) +
        `\nRode \`${APAGAR}\` e semeie de novo.`,
    );
    return 1;
  }

  // **O único relógio do programa.** Daqui para baixo, todo instante vem do plano.
  const resumo = await semear(planoDaDemonstracao(new Date(), perfil), senha);
  imprimirResumo(resumo);
  return 0;
}

function imprimirResumo(resumo: ResumoDaSemeadura): void {
  console.log("");
  for (const organizacao of resumo.organizacoes) {
    console.log(
      `${organizacao.nome.padEnd(LARGURA_DO_NOME)}` +
        `${`código ${organizacao.codigoPublico}`.padEnd(LARGURA_DO_CODIGO)}` +
        `${String(organizacao.ocorrencias)} ocorrências`,
    );

    /**
     * **O recorte que o critério 32.6 confere, e o 32.7 exige** — o dashboard é sempre de UMA
     * organização, e o bloco total abaixo soma as duas. Sem estas linhas, a conferência ponta a ponta da
     * agregação não tem contra o que conferir.
     */
    console.log("  mês       registradas   resolvidas   avaliadas");
    for (const mes of organizacao.meses) {
      console.log(
        `  ${mes.rotulo.padEnd(10)}` +
          `${String(mes.registradas).padStart(11)}` +
          `${String(mes.resolvidas).padStart(13)}` +
          `${String(mes.avaliadas).padStart(12)}`,
      );
    }
    console.log(`  status    ${emLinha(organizacao.porStatus)}`);
    console.log("");
  }

  console.log("");
  console.log("mês       registradas   resolvidas   avaliadas");
  const totais = { registradas: 0, resolvidas: 0, avaliadas: 0 };
  for (const mes of resumo.meses) {
    totais.registradas += mes.registradas;
    totais.resolvidas += mes.resolvidas;
    totais.avaliadas += mes.avaliadas;
    console.log(
      `${mes.rotulo.padEnd(10)}` +
        `${String(mes.registradas).padStart(11)}` +
        `${String(mes.resolvidas).padStart(13)}` +
        `${String(mes.avaliadas).padStart(12)}` +
        // O mês sem resolução é o critério 43.2, e ele é o que a série precisa MOSTRAR.
        `${mes.resolvidas === 0 ? "   <- nenhuma resolução" : ""}`,
    );
  }
  console.log(
    `${"".padEnd(10)}${String(totais.registradas).padStart(11)}` +
      `${String(totais.resolvidas).padStart(13)}${String(totais.avaliadas).padStart(12)}`,
  );

  console.log("");
  console.log(`status    ${emLinha(resumo.porStatus)}`);
  console.log(`pausas    ${emLinha(resumo.porMotivoDePausa)}`);
  console.log(`mensagens ${String(resumo.mensagens)} (só no mês corrente)`);
  console.log(`contas    ${resumo.contas.map((c) => `${c.email} (${c.onde})`).join(" · ")}`);
  console.log("");
  console.log(
    "Os critérios 43.2 e 43.3 fecham pela metade aqui: o mês vazio e a diferença entre avaliadas e",
  );
  console.log(
    "resolvidas estão provados; que o dashboard os MOSTRE é dos itens 36 e 34 (spec §3.9).",
  );
}

function emLinha(contagem: Readonly<Record<string, number>>): string {
  return Object.entries(contagem)
    .map(([chave, quantas]) => `${chave} ${String(quantas)}`)
    .join(" · ");
}

function listar(organizacoes: readonly OrganizacaoEncontrada[]): string {
  return organizacoes
    .map((o) => `  · ${o.nome}, código ${o.codigoPublico}: ${String(o.ocorrencias)} ocorrências`)
    .join("\n");
}

/**
 * **`process.exit` explícito, e é decisão** (achado F-3 do plano). `criarConsulta` guarda um `Pool` de
 * módulo com `idleTimeoutMillis: 10_000`, e `infraestrutura/clientes` não expõe nada que o encerre — sem
 * isto o processo fica pendurado dez segundos depois de terminar. É o que `ferramentas/ambiente-local.mjs`
 * já faz.
 */
principal()
  .then((codigo) => {
    process.exit(codigo);
  })
  .catch((erro: unknown) => {
    console.error(erro);
    process.exit(1);
  });
