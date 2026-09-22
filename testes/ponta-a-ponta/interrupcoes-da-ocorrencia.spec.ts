import { expect, test } from "@playwright/test";

import {
  abrirNoMenu,
  AURORA,
  ciclo,
  ENCARREGADA_DO_AURORA,
  entrar,
  esperarSituacao,
  fecharOMenu,
  HELENA,
  MARCOS,
  marcaDoInstante,
  NOME_DE_HELENA,
  NOME_DE_MARCOS,
  registrarOcorrencia,
} from "./mundo";

/**
 * ============================================================================
 *  As interrupções — pausar, retomar, reatribuir e cancelar, lidos pelos dois lados
 * ============================================================================
 *
 * **O terceiro arquivo de ponta a ponta, e ele nasce pela ADR-0012**: o teste cresce por **jornada** do
 * roteiro de validação, com teto de seis arquivos. Esta é a jornada da Parte 4.4, da 4.5 e da Parte 5 —
 * a ocorrência que **não** segue reta até `Resolvida`.
 *
 * **Por que ela é a jornada de maior valor de descoberta do lote.** A Parte 4.4 do roteiro está marcada
 * `[código]` inteira: as palavras da tabela saíram da leitura do código, e ninguém abriu essas telas. Os
 * itens que ela valida — 18, 21, 23, 24, 28, 30 e 31 — estão todos com a coluna `Val` vazia no painel.
 * E `app/**` está medido em **0,0% de instruções cobertas** em 60 arquivos: nenhum teste de unidade ou
 * de integração executa uma linha de lá.
 *
 * ---------------------------------------------------------------------------
 *  O dono do mundo — exigência da ADR-0012
 * ---------------------------------------------------------------------------
 *
 * **O mundo é a semente de demonstração, e este arquivo não é dono dele.** Ele só **acrescenta**: uma
 * ocorrência nova no Edifício Aurora por corrida, com a marca do instante no título, e as mensagens que
 * escreve dentro dela. Nada semeado muda de estado — o percurso inteiro acontece sobre a ocorrência que
 * ele mesmo criou.
 *
 * Os localizadores compartilhados moram em `mundo.ts`, que é o que a ADR-0012 cobra em troca do teto.
 *
 * **Pré-requisitos, e eles não são automatizados de propósito:** a pilha de pé (`npm run local`) e a
 * semente aplicada (`SENHA_DA_DEMONSTRACAO=… npm run semear:demo`). Os dois estão no cabeçalho de
 * `caminho-critico.spec.ts`, com o argumento inteiro.
 *
 * ---------------------------------------------------------------------------
 *  O que este arquivo NÃO prova, e cada linha tem dono
 * ---------------------------------------------------------------------------
 *
 * | O que fica de fora | Por quê |
 * |---|---|
 * | Três dos quatro motivos de pausa | Só muda a frase que o Solicitante lê, e as quatro frases já têm teste de unidade em `testes/interface/ocorrencia.test.ts`. Aqui se percorre **um**, e a fiação é a mesma nos quatro |
 * | Seis dos sete motivos de cancelamento | A contagem é conferida; o percurso escolhe um. Os sete textos são de unidade |
 * | O cancelamento **pelo Solicitante** | São dois estados de origem (`Aberta` e `Em análise`) e um aviso de visibilidade com outro sujeito — é outra jornada, e cabe no percurso da Parte 4.5 que o teste 5 do lote não cobre |
 * | O recorte de celular | O Playwright roda em 1280 px por decisão do `playwright.config.ts`. A mesma informação está lá pelo recorte C, e é o M-3 quem a confere |
 * | O anel de foco sobre o botão em destaque (44d.4, achado A-4) | O foco **chegar** tem asserção; o anel **estar visível** é olho humano |
 * | A avaliação e a trilha de auditoria | São de `caminho-critico.spec.ts`, e esta ocorrência morre cancelada de propósito: é o outro fim do ciclo |
 *
 * ---------------------------------------------------------------------------
 *  Uma divergência entre o roteiro e o produto, e ela é do roteiro
 * ---------------------------------------------------------------------------
 *
 * O passo 53 do roteiro manda conferir que *"**Pausar** fica apagado até você escolher um motivo **e**
 * escrever alguma coisa"*. **O produto deixou de fazer isso no item 44g**, e por decisão escrita no guia
 * de tela §7 (16/09/2026): *"o botão principal só fica inerte durante o envio; clicado com campo
 * obrigatório vazio, ele mostra os erros e leva o foco ao primeiro"*. `BotaoDeConfirmar` carrega a regra
 * no docblock — *"nunca desabilitado por campo inválido"*.
 *
 * **A garantia do critério 23 é a mesma, e é ela que este teste afirma:** não há como pausar sem motivo
 * e sem observação. O que muda é o mecanismo — em vez de um botão apagado, dois erros em palavra. O
 * roteiro é que ficou para trás, e é achado de roteiro, não de produto.
 */

const MARCA = marcaDoInstante();
const TITULO = `Interrupções ${MARCA} — portão da garagem travado`;
const DESCRICAO = "O portão para no meio do curso e volta. Acontece mais de manhã, na saída.";

/** O motivo de pausa percorrido, nos dois vocabulários — item 23 e glossário §4. */
const MOTIVO_ESCOLHIDO = "Aguardando peça";
const O_QUE_O_SOLICITANTE_LE = "Parada — esperando material chegar";
const OBSERVACAO_DA_PAUSA = "Placa da central encomendada; o fornecedor deu prazo de cinco dias.";

const MOTIVO_DO_CANCELAMENTO = "Sem informação suficiente";
const OBSERVACAO_DO_CANCELAMENTO =
  "Sem o horário exato e sem o número do portão não há como abrir chamado com o fornecedor.";

const PERGUNTA_DE_HELENA = `Tem previsão? ${MARCA}`;
const RESPOSTA_DE_MARCOS = `A peça chega na quinta. ${MARCA}`;

/** Os quatro motivos de pausa, na ordem de `MOTIVOS_DE_PAUSA` — critério 23. */
const MOTIVOS_DE_PAUSA = [
  "Aguardando informação do solicitante",
  "Aguardando peça",
  "Aguardando autorização",
  "Aguardando um terceiro",
];

test("a ocorrência que para no meio: pausar, retomar, reatribuir e cancelar, lidos pelos dois lados", async ({
  browser,
}) => {
  const contextoDeHelena = await browser.newContext();
  const contextoDeMarcos = await browser.newContext();
  const helena = await contextoDeHelena.newPage();
  const marcos = await contextoDeMarcos.newPage();

  // -------------------------------------------------------------------------
  // 1 · Helena entra, escolhe o Aurora e registra a ocorrência marcada
  //
  // **Ela é Solicitante no Aurora e Gestora no Recanto**, e com dois vínculos sem escolha na sessão o
  // servidor pede T-02. É o mesmo passo que `caminho-critico.spec.ts` já percorre; aqui ele é só o
  // preparo do mundo deste arquivo.
  // -------------------------------------------------------------------------
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: AURORA }).click();
  await helena.waitForURL(/\/ocorrencias$/u);

  const ocorrenciaId = await registrarOcorrencia(helena, TITULO, DESCRICAO);

  // -------------------------------------------------------------------------
  // 2 · Marcos entra — e a coluna PRIORIDADE existe do lado dele
  //
  // **É a metade que torna o critério 28.4 uma prova.** Afirmar só a ausência na lista de Helena passaria
  // verde se a coluna tivesse sumido para todo mundo; afirmar os dois lados no mesmo percurso diz que ela
  // existe **e** que ela não chega a quem não pode alterá-la. A regra é de permissão, nunca de recorte —
  // é a correção P-03 do protótipo.
  //
  // Com exatamente um vínculo ativo, o servidor escolhe a organização e grava o cookie na própria
  // resposta: Marcos não passa por T-02.
  // -------------------------------------------------------------------------
  await entrar(marcos, MARCOS);
  await marcos.waitForURL(/\/ocorrencias$/u);
  await expect(marcos.getByRole("columnheader", { name: "Prioridade" })).toBeVisible();

  await marcos.getByRole("link", { name: TITULO }).click();
  await marcos.waitForURL(new RegExp(`/ocorrencias/${ocorrenciaId}$`, "u"));

  // -------------------------------------------------------------------------
  // 3 · Analisar, atribuir a si mesmo e iniciar — o preparo da pausa
  //
  // **"Atribuir a mim", e não a Encarregada.** O percurso precisa que o responsável seja quem conduz,
  // para que a reatribuição do passo 7 encontre a fileira *"Atribuir a mim"* apagada com *"· Responsável
  // atual"* — que é o critério 21 na tela, e é o que o roteiro manda ver no passo 61.
  //
  // **"Atribuir" é botão, e não item de menu, e isso é decisão de produto:** em `em_analise` **sem**
  // responsável a máquina não oferece `iniciar-atendimento` (invariante 9), então sobram três
  // renderizáveis e a tabela `ACAO_PRIMARIA` cai no primeiro — *Atribuir*. É o R-08, e é o que impede
  // *Pausar* de ficar em destaque numa ocorrência que ninguém pegou.
  // -------------------------------------------------------------------------
  await esperarSituacao(marcos, "Aberta");
  await marcos.getByRole("button", { name: "Analisar" }).click();
  await esperarSituacao(marcos, "Em análise");

  await marcos.getByRole("button", { name: "Atribuir" }).click();
  const modalDeAtribuicao = marcos.getByRole("dialog");
  await expect(
    modalDeAtribuicao.getByRole("heading", { name: "Atribuir responsável" }),
  ).toBeVisible();
  await modalDeAtribuicao.getByRole("radio", { name: "Atribuir a mim" }).check();
  await modalDeAtribuicao.getByRole("button", { name: "Atribuir" }).click();
  await expect(marcos.getByText(NOME_DE_MARCOS).first()).toBeVisible();

  await marcos.getByRole("button", { name: "Iniciar atendimento" }).click();
  const modalDeAtendimento = marcos.getByRole("dialog");
  await modalDeAtendimento.getByRole("button", { name: "Iniciar" }).click();
  await esperarSituacao(marcos, "Em atendimento");

  // -------------------------------------------------------------------------
  // 4 · Pausar — o critério 23, e os dois campos obrigatórios
  //
  // **O comando mora no menu, e isso é a conta de largura do item 23:** com quatro renderizáveis em
  // `em_atendimento` — *Reatribuir*, *Pausar*, *Resolver* e *Cancelar* — a barra guarda o destaque e
  // manda o resto para *"Mais ações ▾"*.
  //
  // **A obrigatoriedade é afirmada pelo caminho que o produto tem hoje** — ver a divergência declarada no
  // cabeçalho. Clicar em *Pausar* com o formulário vazio **não envia**, mantém o diálogo aberto e acende
  // os dois erros em palavra. Escolher o motivo apaga o primeiro e deixa o segundo de pé: é a prova de
  // que os dois campos são cobrados, e não só um.
  // -------------------------------------------------------------------------
  const modalDePausa = await abrirNoMenu(marcos, "Pausar");
  await expect(modalDePausa.getByRole("heading", { name: "Pausar" })).toBeVisible();
  await expect(modalDePausa.getByText("O que a ocorrência está esperando.")).toBeVisible();

  // Os quatro motivos, pelo nome de opção — e não pela frase que o Solicitante lê.
  for (const motivo of MOTIVOS_DE_PAUSA) {
    await expect(modalDePausa.getByRole("radio", { name: motivo })).toBeVisible();
  }

  // O aviso de visibilidade vem **antes** do campo, e é a restrição herdada nº 1 do inventário.
  await expect(
    modalDePausa.getByText("O Solicitante vê esta observação. Não há como editá-la depois."),
  ).toBeVisible();

  await modalDePausa.getByRole("button", { name: "Pausar" }).click();
  await expect(modalDePausa.getByText("Escolha o motivo.")).toBeVisible();
  await expect(modalDePausa.getByText("Escreva a observação.")).toBeVisible();
  await esperarSituacao(marcos, "Em atendimento");

  await modalDePausa.getByRole("radio", { name: MOTIVO_ESCOLHIDO }).check();
  await expect(modalDePausa.getByText("Escolha o motivo.")).toHaveCount(0);
  await expect(modalDePausa.getByText("Escreva a observação.")).toBeVisible();

  await modalDePausa.getByLabel(/^Observação/u).fill(OBSERVACAO_DA_PAUSA);
  await expect(modalDePausa.getByText("Escreva a observação.")).toHaveCount(0);
  await modalDePausa.getByRole("button", { name: "Pausar" }).click();
  await fecharOMenu(marcos);

  // **O selo do Gestor colapsa em *Pausada*, e o motivo desce para a segunda linha** — critério 31.8.
  // Para ele os dois textos divergem, e é isso que faz a segunda linha aparecer.
  await esperarSituacao(marcos, "Pausada");
  await expect(marcos.locator("section").filter({ hasText: "Situação" }).first()).toContainText(
    O_QUE_O_SOLICITANTE_LE,
  );

  // **A régua do ciclo — critério 44d.7.** A pausa sai da linha reta e fica ancorada depois do último
  // passo alcançado; *Resolvida* continua por alcançar, e por isso o bloco não a datou.
  await expect(ciclo(marcos)).toContainText("Pausada");
  await expect(ciclo(marcos)).toContainText(O_QUE_O_SOLICITANTE_LE);
  await expect(ciclo(marcos)).toContainText("Resolvida");

  // -------------------------------------------------------------------------
  // 5 · O que o Solicitante lê — critérios 31.3, 31.6, 28.4 e a recusa de acesso
  //
  // **A palavra *Pausada* não chega a Helena, e a asserção é de ausência na página inteira.** Para ela o
  // rótulo **é** a frase com o motivo dentro, e `segundaLinhaDeMotivo` devolve `null` justamente porque
  // os dois textos coincidem — imprimir a segunda linha ali produziria a frase repetida lado a lado.
  // -------------------------------------------------------------------------
  await helena.reload();
  await esperarSituacao(helena, O_QUE_O_SOLICITANTE_LE);
  await expect(helena.getByText("Pausada")).toHaveCount(0);

  // A barra dela está vazia, e a frase é a do critério 18.6: sem `cancelar_qualquer`, o Solicitante
  // autor só cancela enquanto a ocorrência não saiu da triagem.
  await expect(
    helena.getByText("Só os Gestores podem cancelar a partir daqui."),
  ).toBeVisible();

  // **A lista dela — critérios 31.6 e 28.4.** A linha carrega a frase inteira, sem a palavra do Gestor,
  // e não há coluna de prioridade: ela não tem `ocorrencia.alterar_prioridade` em nenhum desenho de papel.
  await helena.goto("/ocorrencias");
  await expect(helena.getByText("Minhas ocorrências")).toBeVisible();
  const linhaDeHelena = helena.getByRole("link", { name: TITULO });
  await expect(linhaDeHelena).toContainText(O_QUE_O_SOLICITANTE_LE);
  await expect(helena.getByText("Pausada")).toHaveCount(0);
  await expect(helena.getByRole("columnheader", { name: "Prioridade" })).toHaveCount(0);

  // **A tela de Gestor aberta pelo endereço** — Parte 5, passo 7. É o `SemAcesso` do item 44h: título,
  // quem usa a tela, a recusa e a saída. **É beco**, e por isso a saída mora no conteúdo.
  await helena.goto("/dashboard");
  await expect(helena.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    helena.getByText("Seu papel nesta organização não dá acesso a esta página."),
  ).toBeVisible();
  await expect(helena.getByRole("link", { name: "Ir para Ocorrências" })).toBeVisible();

  // -------------------------------------------------------------------------
  // 6 · Retomar — o critério 24, e a descrição que NÃO diz para onde
  //
  // **O botão é o destaque em `pausada`** (`ACAO_PRIMARIA.pausada`), e ele nunca cai no menu.
  //
  // **A asserção de ausência é o critério 24.2 na tela:** a janela não nomeia o destino, porque nomeá-lo
  // seria informar antes o que o critério manda descobrir depois — e seria uma frase que a tela não tem
  // como saber verdadeira, já que ela não lê a trilha.
  // -------------------------------------------------------------------------
  await marcos.getByRole("button", { name: "Retomar" }).click();
  const modalDeRetomada = marcos.getByRole("dialog");
  await expect(modalDeRetomada.getByRole("heading", { name: "Retomar" })).toBeVisible();
  await expect(
    modalDeRetomada.getByText("A ocorrência volta ao ponto em que estava antes da pausa."),
  ).toBeVisible();
  await expect(modalDeRetomada).not.toContainText("Em atendimento");
  await modalDeRetomada.getByRole("button", { name: "Retomar" }).click();

  // Volta para onde saiu — e a régua não recua: o passo continua datado da primeira vez.
  await esperarSituacao(marcos, "Em atendimento");
  await expect(ciclo(marcos)).not.toContainText("Pausada");

  // -------------------------------------------------------------------------
  // 7 · Reatribuir — o critério 21, e a fileira apagada
  //
  // **A palavra sai do ESTADO, não da intenção de quem clica:** há responsável, então o gatilho, o
  // título e o botão dizem *Reatribuir*. É `palavrasDaAtribuicao(responsavelAtualPessoaId !== null)`.
  //
  // **"Atribuir a mim" aparece apagada porque Marcos É o responsável atual**, e o estado vai em palavra
  // ao lado — nunca só em opacidade, que é o compromisso A-5.
  // -------------------------------------------------------------------------
  const modalDeReatribuicao = await abrirNoMenu(marcos, "Reatribuir");
  await expect(modalDeReatribuicao.getByRole("heading", { name: "Reatribuir" })).toBeVisible();
  await expect(
    modalDeReatribuicao.getByText(
      "Quem passa a cuidar desta ocorrência. A atribuição atual será encerrada.",
    ),
  ).toBeVisible();

  const fileiraDeMarcos = modalDeReatribuicao.getByRole("radio", { name: "Atribuir a mim" });
  await expect(fileiraDeMarcos).toBeDisabled();
  await expect(modalDeReatribuicao.getByText("Responsável atual")).toBeVisible();

  await modalDeReatribuicao.getByRole("radio", { name: ENCARREGADA_DO_AURORA }).check();
  await modalDeReatribuicao.getByRole("button", { name: "Reatribuir" }).click();
  await fecharOMenu(marcos);
  await expect(marcos.getByText(ENCARREGADA_DO_AURORA).first()).toBeVisible();

  // -------------------------------------------------------------------------
  // 8 · A conversa — critérios 30 e 30.4, e os dois campos nomeando o outro lado
  //
  // **O predicado é a AUTORIA, e não o papel.** Helena é a autora e lê *"Escrever para os Gestores"*;
  // Marcos não é, e lê *"Escrever para o Solicitante"*. É o rótulo do campo que *"impede um Gestor de
  // escrever ali achando que é interno"* depois da primeira linha da conversa.
  //
  // **A mensagem atravessa de verdade:** ela nasce numa janela, é gravada, e a outra janela a lê depois
  // de recarregar. É a fiação que nenhum teste de unidade alcança.
  // -------------------------------------------------------------------------
  await helena.goto(`/ocorrencias/${ocorrenciaId}`);
  await helena.getByLabel(/^Escrever para os Gestores/u).fill(PERGUNTA_DE_HELENA);
  await helena.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(helena.getByRole("heading", { name: "Mensagens 1" })).toBeVisible();
  await expect(helena.getByText(PERGUNTA_DE_HELENA).first()).toBeVisible();

  await marcos.reload();
  await expect(marcos.getByLabel(/^Escrever para o Solicitante/u)).toBeVisible();
  await expect(marcos.getByText(PERGUNTA_DE_HELENA).first()).toBeVisible();
  // A autoria vai em palavra, e do lado de lá ela carrega o nome de quem escreveu.
  await expect(marcos.getByText(NOME_DE_HELENA).first()).toBeVisible();

  await marcos.getByLabel(/^Escrever para o Solicitante/u).fill(RESPOSTA_DE_MARCOS);
  await marcos.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(marcos.getByRole("heading", { name: "Mensagens 2" })).toBeVisible();

  await helena.reload();
  await expect(helena.getByText(RESPOSTA_DE_MARCOS).first()).toBeVisible();

  // -------------------------------------------------------------------------
  // 9 · O Gestor cancela — o critério 18, e os sete motivos
  //
  // **A lista é filtrada por PERMISSÃO, com a mesma função que o comando de aplicação usa para lançar o
  // `422`.** Quem tem `ocorrencia.cancelar_qualquer` recebe os sete; o Solicitante autor recebe quatro.
  // A contagem é a asserção — os sete textos já são de unidade.
  //
  // **O aviso de visibilidade é o do Gestor**, e o predicado é *ser Gestor*, não *ser autor*: quem lê a
  // observação dele é o Solicitante.
  // -------------------------------------------------------------------------
  const modalDeCancelamento = await abrirNoMenu(marcos, "Cancelar");
  await expect(
    modalDeCancelamento.getByRole("heading", { name: "Cancelar a ocorrência" }),
  ).toBeVisible();
  await expect(
    modalDeCancelamento.getByText(
      "A ocorrência será encerrada sem resolução. Não há como reabrir.",
    ),
  ).toBeVisible();
  await expect(modalDeCancelamento.getByRole("radio")).toHaveCount(7);
  await expect(
    modalDeCancelamento.getByText("O Solicitante vê esta observação. Não há como editá-la depois."),
  ).toBeVisible();

  await modalDeCancelamento.getByRole("radio", { name: MOTIVO_DO_CANCELAMENTO }).check();
  await modalDeCancelamento.getByLabel(/^Observação/u).fill(OBSERVACAO_DO_CANCELAMENTO);
  await modalDeCancelamento.getByRole("button", { name: "Cancelar a ocorrência" }).click();

  await esperarSituacao(marcos, "Cancelada");
  // **A linha para, e a marca diz que o ciclo não continua** — critério 44d.7, o outro ramo da saída.
  await expect(ciclo(marcos)).toContainText("O ciclo não continua.");
  await expect(marcos.getByText("Esta ocorrência está encerrada.")).toBeVisible();

  // -------------------------------------------------------------------------
  // 10 · O Solicitante vê a ocorrência encerrada
  //
  // **`Cancelada` é a mesma palavra nas duas colunas do glossário**, e é o único estado em que as duas
  // coincidem fora de `Em análise` e `Resolvida`. O que muda é a barra: nenhuma ação, e a frase terminal
  // no lugar dela.
  // -------------------------------------------------------------------------
  await helena.reload();
  await esperarSituacao(helena, "Cancelada");
  await expect(helena.getByText("Esta ocorrência está encerrada.")).toBeVisible();
  await expect(helena.getByText(OBSERVACAO_DO_CANCELAMENTO).first()).toBeVisible();

  await contextoDeHelena.close();
  await contextoDeMarcos.close();
});
