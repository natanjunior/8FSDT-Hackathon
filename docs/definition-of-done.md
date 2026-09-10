# Definition of Ready e Definition of Done

Dois checklists com funções opostas. O **Definition of Ready** é o conjunto de condições que precisam
valer **antes de uma tarefa começar**. O **Definition of Done** é a lista de critérios que uma tarefa
precisa cumprir para ser **considerada concluída**.

Cada portão desta lista existe por causa de um defeito concreto, e traz o defeito escrito ao lado. Um
checklist cujos itens não dizem o que previnem vira ritual, e ritual é a primeira coisa que se abandona na
última semana.

## Por que estes dois checklists existem aqui

A configuração do projeto — **um implementador, papéis não-implementadores no restante da equipe, e seis
semanas** — torna-os mais necessários que o usual. Nela, testes, container, deploy e documentação, que são
entregáveis exigidos pelo enunciado, são exatamente os itens que ficam por último e não acontecem. O DoD
converte cada um deles de tarefa futura em condição de conclusão de toda funcionalidade.

**Nenhuma caixa depende de outra pessoa para ser marcada.** Portão que quem faz o trabalho não pode fechar
não é portão: é espera, e ou fica marcado assim mesmo, ou o item fica aberto, e os dois desfechos são
piores que não ter o portão. Isso não afrouxa o DoD; torna-o consistente com uma limitação que ele mesmo
declara, a de que **não há revisão de código por pares**. Um checklist que exigisse o segundo par de olhos
para fechar estaria pedindo exatamente a pessoa que este documento diz não existir. O segundo par de olhos
continua existindo, fora do portão, como atividade própria.

---

## Definition of Ready

Uma tarefa só entra em desenvolvimento quando os cinco forem verdadeiros.

| # | Portão | O defeito que ele previne |
|---|---|---|
| 1 | **Descrição e critérios de aceitação escritos.** O que a tarefa entrega, e como se sabe que entregou | Tarefa que termina quando alguém decide que terminou. Sem critério escrito antes, o critério é escrito depois, pelo resultado |
| 2 | **Abordagem técnica clara.** Qual camada muda, qual agregado é afetado, se toca fronteira de contexto. Se a resposta exigir investigação, isso vira uma tarefa de investigação própria, com resultado escrito | Descobrir no meio da implementação que a tarefa era outra, e decidir arquitetura sob pressão de prazo, que é quando a lógica de domínio vaza para o handler |
| 3 | **Quebrada em item implementável.** Cabe numa sessão de trabalho; se não cabe, quebra de novo | Item que atravessa semanas sem entregar nada, e cujo progresso ninguém consegue afirmar |
| 4 | **Priorizada no board, e alocada a uma sprint** | Trabalho que existe só na cabeça de quem o faz, e some quando a semana aperta |
| 5 | **Nenhum ponto de atenção em aberto que mude o comportamento desta tarefa.** Consulta a [premissas-e-questoes-abertas.md](premissas-e-questoes-abertas.md). Se houver, ou a questão se resolve, ou a tarefa espera, ou a premissa é assumida por escrito | Implementar sobre uma ambiguidade não resolvida. Há 28 pontos de atenção registrados, 18 deles ainda abertos, e nenhum foi resolvido em silêncio |

O portão 5 não tem equivalente num checklist genérico, e existe porque este projeto não teve validação de
domínio com ninguém de fora do time: toda decisão de domínio é suposição.

---

## Definition of Done

Uma funcionalidade só está pronta quando todos os itens abaixo forem verdadeiros.

### Qualidade do código

| Portão | O defeito que ele previne | Como se confere |
|---|---|---|
| `lint` e verificação de tipos passando, sem exceção adicionada para fazer passar | Código que compila na máquina de quem escreveu | `npm run lint` e `npm run tipos` |
| **A regra de fronteira respeitada:** nada fora de `infraestrutura/clientes/` importa um SDK, e `infraestrutura/` só é importada por `composicao/` | A camada de domínio conhecendo banco, que é o que faz a máquina de estados vazar para o handler sob pressão de prazo. **A regra é o alarme, não a garantia:** a garantia é a Aplicação não ter o que importar, porque recebe a porta em vez de construir infraestrutura ([ADR-0005](adr/0005-regra-de-dependencia-por-inversao.md)) | `npm run lint`, pelas regras de fronteira do `eslint.config.mjs`. Não há um único `eslint-disable` no projeto |
| **O repositório devolve agregado ou objeto de leitura declarado, nunca linha de banco** e nunca tipo de ORM | A forma do esquema subindo para dentro da aplicação, o que faz uma mudança de coluna atravessar três camadas | **Revisão do tipo de retorno.** É o único item desta lista que o lint não consegue conferir: a assinatura é legítima, e só devolve a coisa errada |
| **Módulo novo passa nos dois testes**, se a tarefa criou um: é útil, com limites e responsabilidade definidos, e é competente, fazendo inteiro o que faz | Pasta vazia por simetria, que sugere estrutura onde não há comportamento | Leitura do diretório novo no próprio diff |
| **Nenhum handler toca mais de um agregado** | O controller inchado, que acumula responsabilidade até ninguém saber o que ele faz. O Next.js já protege por acidente, com um `route.ts` por caminho | Leitura do handler no diff. Um handler que precise de dois agregados é caso para dividir |
| **Toda consulta nova passa pelo repositório escopado à organização** | **O risco mais sério da [ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md):** a garantia de isolamento é do código, e um caminho que ignore o repositório vaza dados entre condomínios | `npm run lint` pega o import; o teste de integração pega o resultado |
| **Consulta que envolva pessoas parte de `vinculos`, nunca de `pessoas`** | Uma listagem que devolve o cadastro do sistema inteiro. A tabela `pessoas` é global e não tem coluna de organização, então não há filtro que o repositório possa aplicar nela | **Teste.** A regra de lint não alcança este caso, porque a consulta é legítima: ela apenas parte da tabela errada |
| **Nenhum segredo assado na imagem.** Sem `ARG` com segredo, sem `.env` copiado para dentro do container | Segredo publicado. A imagem é pública ([ADR-0004](adr/0004-execucao-em-container-no-azure.md)), e o que entra numa camada permanece legível mesmo que um `RUN rm` apague o arquivo depois | Leitura do `Dockerfile` no diff. Em Next.js, apenas variáveis `NEXT_PUBLIC_*` podem ser embutidas em tempo de build |
| **As verificações mecânicas do contrato de API passam**, se a tarefa toca um endpoint | Ver a tabela abaixo: cada uma protege uma decisão que se perde em silêncio | `npm run verificar:openapi` |

As verificações do contrato, e o que cada uma impede:

| Verificação | O que ela impede |
|---|---|
| `status` não aparece em nenhum schema de entrada | Que a `Ocorrência` ganhe um `PATCH` e a ADR-0001 caia junto |
| Nenhum caminho contém `pessoas` | O vazamento entre organizações mais provável do produto, subindo da consulta para a superfície pública |
| `organizacao` só nos dois caminhos permitidos | Que a organização volte a ser informada pelo cliente, contra a ADR-0003 |
| `requestBody.required: false` corresponde a `corpoOpcional` na rota | Que a especificação publique um corpo dispensável e a rota responda `415` a quem confiar nela, e o contrário |

A última nasceu de um defeito real: um endpoint declarava corpo opcional na especificação e a rota
respondia `415` a quem não mandasse corpo, e isso ficou aberto por semanas **sem que nada acusasse**,
porque era a primeira verificação a comparar o YAML com os `route.ts`.

**A especificação versionada corresponde ao código.** Hoje o `openapi.yaml` é escrito à mão, e o
`npm run verificar:openapi` compara os dois lados. A geração da especificação a partir dos schemas de
validação continua sendo o destino, e é dívida declarada com o portão que a cobre nomeado. Sem esse
portão, o contrato vira documentação que descreve um sistema que não existe mais.

**Os sete compromissos de acessibilidade do protótipo estão cumpridos**, se a tarefa toca interface. **Não
há teste de acessibilidade neste projeto e não haverá**, e está declarado como limitação. O que existe no
lugar é compromisso de construção, conferido a olho, e três dos sete não precisam de ferramenta nenhuma:

| # | Confere-se assim |
|---|---|
| A-1, todo campo tem rótulo associado ao controle | Clicar no rótulo põe o foco no campo. `placeholder` não é rótulo: se o texto some ao digitar, está errado |
| A-3, nenhum alvo de toque menor que cerca de 44 px no celular | Medir um botão e um item de lista na largura de celular. É a pessoa com uma mão no corrimão, que é o cenário literal do RNF6 |
| A-5, nada é comunicado só por cor | Prioridade, status e motivo de pausa sempre carregam a palavra. Marcador colorido sem texto é defeito, em qualquer tela |

Os outros quatro — ordem de foco igual à de leitura, foco visível não removido, nada só em dica de
ferramenta, e a trilha de auditoria como tabela de verdade — são compromissos que a revisão confere quando
a tela existir. **Isto não é conformidade declarada:** afirmar acessibilidade sem teste seria o mesmo erro
que afirmar usabilidade sem teste.

### Testes

| Portão | O defeito que ele previne | Como se confere |
|---|---|---|
| Teste automatizado cobrindo o **caminho feliz** | Funcionalidade que nunca foi executada inteira | `npm run teste` |
| Teste cobrindo **ao menos uma transição inválida**, se a tarefa toca a máquina de estados | Uma transição proibida que passa, o que quebra o requisito central do enunciado sem erro visível | `npm run teste` |
| **Transição gerando registro de histórico, verificado em teste** | Transição sem registro. É a defesa processual do requisito que o enunciado mais destaca, complementar à defesa estrutural do agregado (ADR-0001) | `npm run teste` |
| **O custo de teste desta tarefa foi um arquivo curto ou nenhum**: casos no teste do agregado, e uma entrada na suíte de isolamento se tocou consulta | O DoD virar teatro no décimo item, não por má-fé e sim por aritmética. **Quatro arquivos de teste novos são sinal de que a forma da [ADR-0008](adr/0008-a-suite-de-testes-segue-a-garantia.md) foi abandonada** | Contando arquivos no próprio diff. Está aqui, e não na ADR, porque ADR registra e não confere |
| Se a tarefa toca consulta de dados: teste de integração provando que **organização A não vê dado de B** | O vazamento entre organizações, que é o risco número um do produto | `npm run teste:integracao`. **É uma entrada na suíte de isolamento, e não um teste novo**, e a entrada semeia apenas o próprio agregado, porque semente com pessoas distintas por organização não detecta o erro |
| **Se a tarefa entrega o registro de ocorrência: ele foi cronometrado** | Um requisito na margem que nunca é medido é um requisito que se supõe cumprido. O RNF6 é o único requisito cronometrado do projeto, e o orçamento do protótipo indica que ele fecha por pouco | Cronômetro, no procedimento abaixo. Não é teste de usabilidade: é a diferença entre medido e declarado |

**O procedimento da cronometragem**, para que "cronometrado" não dependa de improviso no dia:

- **Quem:** quem implementa. Aqui não há mecânica possível, porque celular real em rede móvel não se
  automatiza, então **o viés fica declarado em vez de embutido num requisito que ninguém pode cumprir**:
  quem construiu a tela sabe onde tocar sem procurar, e mede um tempo melhor que o de um morador. As três
  medições e a mediana são o instrumento que sobra contra o viés, e o número anotado com aparelho e rede
  permite que outra pessoa repita depois, sem que a entrega dependa disso.
- **Com o quê:** o aparelho da própria pessoa, em rede móvel e não Wi-Fi, contra a URL publicada, com o
  atalho do PWA já instalado.
- **O quê:** cronômetro do toque no atalho até a confirmação na tela, no cenário declarado do RNF6,
  inclusive o comprimento da descrição, que é a premissa que sozinha move o resultado em mais de vinte
  segundos.
- **Quantas vezes:** três. Registra-se a mediana, e também as três.
- **O que se anota:** os três tempos, o modelo do aparelho, a rede, e qual passo pareceu mais longo, porque
  a premissa mais frágil do orçamento é a velocidade de digitação, e é a nota qualitativa que a refutaria.
- **Onde fica:** uma linha datada no [protótipo](prototipo-low-fi.md), ao lado do orçamento que ela testa.
  Não é documento novo.

**E se estourar, é decisão de produto, e não de teste.** O orçamento fecha em 53 s de 60. Uma medição acima
de 60 s não reprova a tarefa: abre questão de escopo, como cortar campo ou reordenar a tela, e entra como
questão aberta registrada, e não como conserto silencioso.

### Revisões

**Esta seção não tem caixa, e a ausência é deliberada.**

A revisão funcional continua existindo e continua sendo acompanhada, e **deixa de ser condição de
conclusão**. É atividade própria, com item de trabalho próprio, e corre em paralelo: levanta achado
depois, sem travar a entrega. O que fecha o item é o que quem o fez consegue verificar sozinho.

Limitação declarada: com um implementador, **não há revisão de código por pares**. A revisão que existe
é funcional: valida comportamento contra critério de aceitação, e não implementação. Registrar a limitação
é mais defensável que classificar como revisão por pares algo que não é, e é a mesma limitação que a
[ADR-0008](adr/0008-a-suite-de-testes-segue-a-garantia.md) cita como uma das três restrições que moldaram
a arquitetura de testes inteira.

**O que substitui o segundo par de olhos, e não é pouco:**

| Instrumento | O que ele faz no lugar do revisor |
|---|---|
| Os critérios de aceitação | Foram escritos a partir da documentação, antes de existir código, por quem não estava implementando. Conferir contra eles é conferir contra artefato independente: **a independência está no momento em que foram escritos, e não na pessoa que confere** |
| Os verificadores do repositório | Mermaid, OpenAPI, referências e tom rodam a cada push, **com controle negativo**. Um verificador que aceita tudo é indistinguível de um que funciona, e o controle é o que os separa |
| As regras de fronteira no ESLint | Conferem a regra de dependência sem depender de ninguém lembrar |
| A suíte de isolamento | Aplica os mesmos casos a toda consulta escopada, preservando o cenário que detecta o vazamento |
| O portão de contrato | Compara a especificação com as rotas e falha se divergirem |

**Este projeto compensa a ausência de revisor com máquina**, e é isso que o checklist diz, em vez de pedir
uma pessoa que ele mesmo declara não existir.

### Documentação

| Portão | O defeito que ele previne | Como se confere |
|---|---|---|
| **Glossário atualizado** se surgiu termo novo | Dois nomes para a mesma coisa, que é o defeito que o glossário existe para impedir | Leitura do diff contra [glossario.md](glossario.md) |
| **ADR escrita** se houve decisão de arquitetura com alternativa rejeitada | Decisão tomada e esquecida, que volta a ser discutida em três semanas sem o contexto que a produziu | Leitura do diff contra `docs/adr/` |
| Endpoint novo documentado | Superfície pública que existe no código e não no contrato | `npm run verificar:openapi` |
| **Todo bloco Mermaid do repositório tem sintaxe válida** | Diagrama que não renderiza é documentação que não existe, e a falha é silenciosa: o GitHub mostra o bloco de código cru e ninguém percebe | `npm run verificar:mermaid` |
| **Toda referência de seção e todo link relativo resolvem** | A referência que aponta para o lugar errado é idêntica à que aponta para o certo até alguém clicar, e a banca clica | `npm run verificar:referencias` |
| **Os documentos já reescritos não recaem nos padrões de tom** | O texto voltar a ficar denso e a se apoiar em fonte que o leitor não tem, um documento de cada vez | `npm run verificar:tom` |
| **Ponto de atenção novo está escrito no relatório do item**, e ponto de atenção resolvido está apontado lá | Achado que morre na conversa em que apareceu | Leitura do próprio relatório, sem terceiro e sem acesso a `docs/` |

A outra metade do último item precisa estar dita aqui, ou vira promessa oral. Levar os achados do
relatório para [premissas-e-questoes-abertas.md](premissas-e-questoes-abertas.md) é passo declarado do
ciclo de quem commita, e não do item: ao commitar o trabalho de um item, os achados do relatório são
transcritos. É atividade com dono e que não segura entrega.

Sem isto escrito, o achado fica no relatório e alguém transcreve depois, que é o que este documento chama
de espera em vez de portão. Um item fechou com **sete achados nessa condição**, e foi o que
mostrou que a caixa antiga era immarcável por construção: ela pedia uma escrita em `docs/` que o próprio
fluxo de trabalho proíbe.

### Publicação

| Portão | O defeito que ele previne | Como se confere |
|---|---|---|
| **Sobe no `docker compose`, do zero** | Estado local escondido, ou seja, a aplicação que só funciona na máquina de quem a escreveu | **A esteira sobe o compose num runner limpo e bate na aplicação por HTTP.** Prova melhor que uma conferência humana: não pode ser esquecido, e reverifica a cada push |
| **Publicado no ambiente único e acessível por URL** | Entrega que existe só como código, e cuja publicação vira descoberta de última semana | A URL responde. Não há ambiente de preview por branch, e a consequência está declarada na [arquitetura](arquitetura.md) §9 |
| **Conferido contra os critérios de aceitação escritos no Ready** | Autoavaliação disfarçada | Os critérios foram escritos a partir da documentação, antes de existir código, por quem não estava implementando |

**Se a revisão funcional reprovar depois** — e agora ela chega depois, porque não trava a entrega —, o
caminho de volta é redirecionar o tráfego para a revisão anterior do Container Apps, que é imediato e não
exige rebuild. **É o que torna aceitável tirar a revisão do portão:** o custo de descobrir tarde é um
redirecionamento. Essa garantia depende do modo de revisões múltiplas, e a precondição está registrada na
[arquitetura](arquitetura.md) §9.

---

## Onde estes checklists vivem no dia a dia

Cada um tem item de trabalho próprio no board, o que é o que os impede de virar checklist que ninguém abre.

| Portão | Onde vive | Quem verifica |
|---|---|---|
| Ready | Critério de entrada do item de backlog. Enquanto os cinco não forem verdadeiros, ele não entra em sprint | Quem escreve o item |
| Done | Critério de aceitação do item que faz o trabalho | Quem implementa, porque nenhuma caixa depende de terceiro |
| Revisão funcional | Item próprio, em paralelo | Quem não implementou, e não bloqueia a conclusão |

O item de revisão continua existindo, e o motivo mudou de lugar: **revisão é atividade, e não etapa
implícita de outra atividade**. Ela precisa de dono e de prazo próprios justamente porque deixou de ser
condição de entrega, porque sem item próprio uma atividade que não bloqueia nada é uma atividade que não
acontece.

**E o que impede o Done de virar autoavaliação não é o dono separado: são as caixas.** A maioria delas não
depende de opinião, porque são `lint`, tipos, testes, os quatro verificadores, o portão de contrato e o
compose na esteira. **A caixa que alguém marcaria de má-fé é a mesma com qualquer dono; a caixa que uma
máquina fecha, ninguém marca.**

A consequência prática é que toda tarefa continua gerando dois itens de trabalho, o que faz e o que
confere, com uma diferença: **o segundo não segura o primeiro.**

---

## O que este documento garante, em uma frase

O agregado garante a auditabilidade **por estrutura**, porque não existe caminho de código que mude o
status sem gravar o histórico. O Definition of Done garante a mesma invariante **por processo**, porque não
existe funcionalidade concluída sem um teste que prove que a transição gerou registro. As duas defesas são
independentes, e é por isso que valem as duas.
