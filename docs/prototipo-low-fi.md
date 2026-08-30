# Protótipo Low-Fi — Resolve Aí

**A forma das dez telas que o [inventário](inventario-de-telas.md) definiu — e as dezesseis coisas que
desenhar descobriu.**

Deriva de [inventario-de-telas.md](inventario-de-telas.md) (o conteúdo de cada tela, os estados, o alvo
primário — **este documento não redecide nada disso**), [documentacao-da-demanda.md](documentacao-da-demanda.md)
(as personas e os RNFs, em especial RNF5, RNF6 e RNF8), [glossario.md](glossario.md) — **todo texto de
interface saiu daqui, e os rótulos de status são literais da tabela da §4** —,
[contrato-de-api.md](contrato-de-api.md) e [`api/openapi.yaml`](api/openapi.yaml) (os campos e os
tamanhos máximos, que são o que decide quantos caracteres cabem numa linha),
[fluxos-e-diagramas.md](fluxos-e-diagramas.md) (DG-4 e DG-5) e
[premissas-e-questoes-abertas.md](premissas-e-questoes-abertas.md) (o PA-16 e o PA-25, que são os dois
que mais mudaram o desenho).

> **O que este documento é.** Um protótipo de baixa fidelidade existe para **derrubar uma hipótese antes
> de ela custar caro**. O entregável não é o desenho: é o que o desenho descobriu. A parte mais cara aqui
> é a **§2 — o orçamento de tempo do RNF6**, o único requisito cronometrado do projeto, que nunca foi
> medido e que este passo mede pela primeira vez, ainda que no papel.
>
> **O que este documento não é.** Não é evidência. **Não haverá teste de usabilidade neste projeto** —
> está declarado como limitação 4 da Documentação da Demanda, ao lado do risco de usabilidade
> classificado como **alto**. Toda decisão de interação aqui é **suposição**, e a §11 as lista. Apresentar
> qualquer uma delas como evidência seria o erro mais grave que este documento poderia conter.

**Citação de fonte.** Nenhuma das nove aulas de DDD trata de interface — nem de layout, nem de estado de
espera, nem de acessibilidade, nem de componente. **Tudo neste documento é [FONTE EXTERNA]** e se
sustenta por mérito próprio, no mesmo regime que o inventário aplicou ao vocabulário de tela.

---

## 1. Como ler — a fidelidade, o meio e a curadoria

### 1.1 O que "low-fi" significa aqui, e como se cumpre

**Meio: HTML em [`prototipo/telas.html`](prototipo/telas.html), e blocos de texto monoespaçado neste
arquivo enquanto o HTML de cada tela não existir.** Decisão do hub de 21/08/2026 — ver a §15.

A moldura de texto renderiza no GitHub e entra em diff, o que a fez ser a escolha certa por dois passos.
Mas ela tem um defeito que só apareceu na revisão: **ela convence escolhendo o texto que cabe.** Largura
fixa esconde exatamente o que precisa ser visto — o título de 150 caracteres, a lista de trinta áreas, o
nome de organização que ocupa a barra inteira. O HTML mostra o pior caso e o tamanho real do alvo de
toque; a moldura não mostrava nem um nem outro.

**Os dois continuam feios de propósito**, e isso é a regra e não a desculpa: cinzas, uma cor de destaque
para estado, sem marca e sem tipografia autoral. Protótipo bonito cedo demais impede exatamente o que ele
existe para produzir — **ninguém critica o que parece pronto.**

> **Um desenho, um lugar.** Onde o HTML de uma tela existir, **a moldura correspondente sai deste
> arquivo**, substituída por um link. O que fica é o que a moldura nunca carregou: a afirmação do que a
> tela mostra, a origem de cada elemento, o que ela deliberadamente não mostra, e o orçamento da §2.
>
> **E o HTML herda a obrigação dos outros documentos: se a tela mudar na revisão, ele muda junto.**
> Entregável desatualizado é pior que entregável ausente, e este é o mais fácil de esquecer, porque
> ninguém relê HTML.

| Proibido, porque é o passo seguinte ou não é passo nenhum | Obrigatório |
|---|---|
| cor · marca · logotipo · escolha de fonte · sombra · arredondamento · valor de espaçamento | **texto real, em português, sempre** |
| ícone com significado próprio — um ícone é uma decisão visual | os **rótulos de status literais** da tabela do glossário §4 |
| qualquer decisão que mude quando o cliente troca de cor | ordem, hierarquia, agrupamento, tamanho relativo, alvo de toque |

**Nada de *lorem*, nada de "Título da ocorrência aqui".** Texto falso esconde o problema de tamanho, que
é metade do que um protótipo low-fi existe para achar — e neste projeto o problema de tamanho é agudo,
porque o `openapi.yaml` permite `titulo` de 150 caracteres e `Area.nome` de 80, e a linha de um item de
lista de celular comporta cerca de 38. A §10, achado **P-06**, é o que isso produziu.

> **Nomes próprios nos desenhos são dado de exemplo, não ator.** *Marina Rocha*, *Roberto Salles* e
> *Antônio Ferreira* aparecem porque `autor.nome` e `responsavel.nome` são campos reais e o comprimento
> deles decide o layout — texto falso mentiria sobre isso. **Os atores continuam sendo `Solicitante`,
> `Gestor` e `Encarregado`**, e é assim que são nomeados em toda a prosa (aula 2, p.7).

### 1.2 O que foi renderizado, e quantos estados cada tela ganhou

**As treze telas do inventário estão renderizadas**, em [`prototipo/telas.html`](prototipo/telas.html).
A divisão que este documento fazia — *seis desenhadas, sete descritas* — **deixou de existir em
21/08/2026**, quando o hub tornou o HTML entregável.

E vale registrar por que ela existia, porque o motivo não era preguiça: **desenhar em texto monoespaçado
custava caro e rendia pouco.** Uma moldura de ASCII de trinta linhas para dizer *"um campo e um botão"*
era ruído, e ruído esconde o que importa. Em HTML o custo desaparece — a tela é escrita uma vez e mostra
o pior caso, o alvo de toque e o teclado subindo, coisas que nenhuma descrição estruturada entrega.

**O critério não morreu; ele mudou de alvo.** Antes decidia *se* a tela era desenhada. Agora decide
**quantos estados ela ganha** — e a distribuição continua sendo informação:

| Tela | Estados | O que os estados provam |
|---|---:|---|
| **T-04 · Registrar ocorrência** | 9 | É o RNF6 inteiro. A ordem dos campos, o que fica sem rolar, o teclado subindo, o upload em paralelo, e os dois vazios que quebram a tela |
| **T-03 · Ocorrências** | 8 | Duas caras escolhidas por `visibilidadeAplicada`, mais `todas` no celular — e os **três vazios diferentes**, que é onde o erro clássico mora |
| **T-05 · Ocorrência** | 8 | Onze comandos, a gaveta com a pré-visualização do aviso, o mesmo detalhe visto por dois papéis, e o `409` que se explica sozinho |
| **T-01 · Entrar** | 6 | O pior caso do e-mail, e os dois estados de aterrissagem de e-mail que não são tela |
| **T-02 · Sem organização ativa** | 6 | As quatro faces, o cold start, e os três erros do código |
| **T-08 · Aprovação do pedido** | 6 | O PA-25 sendo prevenido pela forma — e o que a prevenção custa em altura no celular |
| **T-06 · Trilha de auditoria** | 5 | Que os cinco campos do F5 **não são cinco colunas**, com uma `observacao` de 1.000 caracteres de verdade |
| **T-07 · Dashboard** | 5 | Cinco indicadores sem virar painel de aeroporto, **e sem biblioteca de gráfico** |
| **T-12 · Redefinir senha** | 5 | A frase condicional do fim, que é o conteúdo da tela |
| **T-11 · Criar conta** | 4 | Os três campos, e o `nome` que fecha o F6 e vai para a trilha imutável |
| **T-09 · Categorias e áreas** | 4 | As cinco frases e o gatilho de cada uma — inclusive a que só existe para gastar `ocorrenciasComTipoAnterior` |
| **T-13 · Definir nova senha** | 4 | O link vencido, que é o caso **provável** e não o raro |
| **T-10 · Vínculo sem permissões** | 3 | Que a tela **é** o texto, e que o terceiro parágrafo não pode ser nota de rodapé |

**Treze telas, 73 estados, 56 molduras de celular e 17 de tela grande.** A tela mais restringida do
inventário e a que carrega dezesseis capacidades ficaram com o maior número de estados, e a que é três
parágrafos de texto ficou com o menor — que é o critério funcionando.

### 1.3 A notação que saiu junto com os desenhos

**As convenções dos desenhos saíram junto com eles.** A tabela de símbolos que vivia aqui —
`┌───┐` para o limite da tela, `┌ ─ ┐` para a dobra, `[ Botão ]` para a ação primária — descrevia uma
notação que este documento não usa mais. **O que a substitui não é uma legenda: é a própria tela**, em
[`prototipo/telas.html`](prototipo/telas.html), onde o limite da tela é o limite da tela e o alvo de toque
tem o tamanho que vai ter.

---

## 2. O orçamento de tempo do RNF6

> **RNF6 · Registro em menos de 1 minuto pelo celular.** *"Da abertura do app ao envio da ocorrência,
> incluindo foto — mitiga o risco de usabilidade."*

É o **único requisito cronometrado do projeto**, é a mitigação do **segundo risco mais alto** da análise
de Cagan (*"se o morador não registrar em menos de um minuto, ele volta para o WhatsApp e o produto
morre"*), e a limitação 4 do inventário registra que **ninguém nunca o mediu**. O orçamento abaixo é a
primeira tentativa.

### 2.1 As premissas da conta — e a mais frágil delas

| # | Premissa | Origem |
|---|---|---|
| 1 | Aparelho de gama média, rede móvel morna, aplicativo já instalado; o atalho do PWA abre **direto em T-04** (inventário §6) | decisão já tomada |
| 2 | **Digitação com um polegar a ~2,5 caracteres por segundo**, já incluindo correção | **[FONTE EXTERNA] · estimativa, não medição** |
| 3 | Toque em alvo grande ≈ 0,5 s; abrir um seletor ≈ 0,3 s | [FONTE EXTERNA] |
| 4 | Câmera do sistema abre em ~2 s; enquadrar e disparar é tempo humano | [FONTE EXTERNA] |
| 5 | O texto do cenário é o **exemplo do próprio contrato** (§8.3): título *"Lâmpada queimada na garagem"* — 27 caracteres — e descrição *"A lâmpada da vaga 34 está queimada há três dias; à noite o corredor fica escuro."* — 79 caracteres | `contrato-de-api.md` §8.3 |

> **A premissa 2 é o número mais frágil deste documento**, e ela sozinha move o resultado em mais de
> vinte segundos. É exatamente o que o artefato clicável da §9 mediria, e a razão de eu recomendá-lo.

### 2.2 A conta, com a tela como o inventário a especificou

Ordem dos campos do inventário: `titulo` · `descricao` · `categoriaId` · `areaId` ·
`localizacaoComplemento` · `imagem`. Área como seletor alfabético de ~30 itens (S-T10).

| # | Passo | Piso | **Típico** | Teto | Quem controla |
|---|---|---:|---:|---:|---|
| 1 | Abrir: toque no atalho até T-04 utilizável | 2 | **3** | 4 | nós |
| 2 | Foto: tocar · câmera abrir · enquadrar · disparar · confirmar | 8 | **11** | 15 | usuário + SO |
| 3 | Compressão no aparelho — 1600 px / 400 KB (RNF8) | 0,8 | **1,5** | 3 | nós |
| 4 | Título — 27 caracteres | 9 | **12** | 16 | usuário |
| 5 | **Descrição — 17 / 79 / 140 caracteres** | 7 | **32** | 56 | **usuário** |
| 6 | Categoria — seletor de 7 a 15 itens, na ordem do Gestor | 3 | **4** | 6 | nós |
| 7 | **Área — seletor alfabético de ~30 itens** | 6 | **12** | 20 | **nós** |
| 8 | Complemento do lugar — opcional, pulado no típico | 0 | **0** | 8 | usuário |
| 9 | Enviar até o `201` — o corpo tem ~200 bytes, não 400 KB | 1 | **1,5** | 3 | nós |
| | **Total** | **36,8** | **77** | **131** | |

*(o upload da foto corre em paralelo aos passos 4 a 8 e **não entra na soma** — é exatamente o que o DG-5
compra)*

**O típico estoura em 28%. O teto é mais que o dobro do alvo.**

E os dois maiores itens da conta são os dois extremos de controle: o passo 5 é o mais caro e **não é
nosso**; o passo 7 é o segundo mais caro e **é inteiramente nosso**.

### 2.3 O que o desenho fez com cada estouro

| Passo | O que o desenho mudou | Ganho |
|---|---|---|
| **7 · Área** | O seletor alfabético vira **campo com busca, com as áreas usadas recentemente no topo** (§3) | **−8 s** |
| **4 e 5 · Título e descrição** | Passam a ser **consecutivos**, com os dois seletores depois deles. Separar dois campos de digitação com um seletor custa **duas trocas de teclado** — cada uma é o teclado descer, a tela reposicionar e ele subir de novo | **−1,5 s** |
| **2 · Foto** | Vira o **primeiro alvo da tela**, acima do título. Não muda a soma — o upload já corria em paralelo —, mas **garante que o paralelismo aconteça**: com a foto por último, os 400 KB entram na conta (~3,5 s em 4G real, ~12 s em rede ruim) | **0 s típico; −3 a −12 s de risco** |
| **5 · Descrição** | O campo abre com **duas linhas de altura, não oito**, e a ajuda diz *"Uma ou duas frases bastam."* Campo alto pede parágrafo; campo baixo pede frase. É a única alavanca de desenho sobre o passo mais caro — e ela é fraca | não estimável |
| **8 · Complemento** | Deixa de ser campo solto e passa a viver **dentro de um bloco "Onde"**, junto com a Área — porque o glossário define **Localização** como *"uma referência a uma Área mais um complemento em texto livre"*. Um conceito, um bloco | 0 s, e o formulário perde um rótulo |

### 2.4 A conta depois do desenho

| Cenário | Total | Fecha? |
|---|---:|---|
| Descrição curta — ~25 caracteres, *"Queimada faz três dias"* | **47 s** | **sim**, com folga |
| **Descrição de ~40 caracteres** | **53 s** | **sim**, com 7 s de folga |
| Descrição do exemplo do contrato — 79 caracteres | **69 s** | **não** |
| Qualquer um dos acima **sob cold start** (RNF5) | +5 a +15 s | **não** |

**A conclusão, dita sem arredondar para bonito:**

> **O RNF6 fecha se e somente se a descrição for uma frase curta, a área for rápida e a requisição não
> for a primeira do dia.** O desenho recuperou os ~9,5 segundos que estavam ao alcance dele. Os outros 16
> que faltam no cenário do contrato **não são de desenho**: são de quanto a pessoa escreve, e a única
> forma de mudá-los seria tornar a `descricao` opcional — que é decisão de contrato, e não é minha.

**E o achado que isso produziu, que vale mais que a conta:**

> **O RNF6 não é verificável como está escrito.** *"Registro completo em menos de um minuto"* não diz o
> que se escreve, e a diferença entre uma descrição de 17 caracteres e uma de 140 é de **49 segundos** —
> mais de 80% do orçamento inteiro. Um requisito cronometrado sem cenário declarado não é um requisito
> cronometrado: é um desejo com um número ao lado. Proposta na §13: **o RNF6 ganha um cenário de
> medição**, e com ele passa a fechar em 53 s, com 7 s de folga.

### 2.5 O cold start dentro do minuto — a colisão RNF5 × RNF6

**Dois requisitos deste projeto se contradizem, e nenhum documento reconciliou os dois.** O RNF5 declara
que *"cold start na primeira requisição após ociosidade é esperado e declarado"*. O RNF6 cronometra *"da
abertura do app ao envio"*. **A primeira requisição do dia acontece dentro do minuto do RNF6.**

O desenho não resolve isso — nada resolve, enquanto a plataforma escalar a zero —, mas **esconde parte
dele, por consequência da mesma decisão que economizou as trocas de teclado**:

```
   t=0        t≈3s                    t≈27s                        t≈53s
    │          │                        │                            │
   abrir ──── foto ──── título ──── descrição ──── categoria ──── área ──── enviar
              └──────── 24 s em que a tela não precisa de rede ────┘
                            ↑
                  é aqui que GET /categorias e GET /areas
                  têm para chegar — e é por isso que os dois
                  seletores vêm DEPOIS dos dois campos de texto
```

> **Um cold start de até ~24 segundos é invisível ao Solicitante, porque os dois únicos campos que
> dependem da rede são os dois últimos.** Acima disso, o campo de categoria mostra o esqueleto e a frase
> do RNF5 — e o relógio do RNF6 continua correndo.

São **três justificativas independentes para a mesma ordem de campos**: economia de teclado, cobertura do
cold start e paralelismo do upload. É o tipo de convergência que dá alguma confiança numa decisão que
não foi testada com ninguém.

### 2.6 A conta depois da rodada de 22/08 — zero segundo

**A modelagem mudou T-04, e o orçamento não mudou.** Isso precisa de prova, não de afirmação:

| O que mudou em T-04 | Custo em segundos | Por quê |
|---|---:|---|
| `POST /imagens/autorizacoes` → `POST /anexos/autorizacoes` | **0** | O nome do endpoint não é interação. A requisição é a mesma, no mesmo momento |
| Uma autorização passou a subir **dois** objetos — original e miniatura | **0** | Os dois `PUT` correm **em paralelo**, fora do caminho crítico, e a miniatura tem ~15 KB contra ~400 KB. O passo 3 do orçamento (compressão) já gerava as duas: redimensionar para 200 px é a mesma operação de canvas do RNF8, no mesmo passe |
| `IMAGEM_*` → `ANEXO_*` nas mensagens de erro | **0** | Caminho de erro não entra no cenário de medição |
| `409 ANEXO_JA_REIVINDICADO` | **0** | Idem — e é caminho que só existe depois de a rede cair |
| O campo **`titulo` do anexo NÃO entra** | **0**, e é o ponto | Ver abaixo |

> **O `titulo` do anexo teria custado, e é por isso que ele fica fora.** O contrato o aceita e a coluna
> existe. Um campo de texto opcional a mais em T-04 custa: o **espaço acima da dobra**, que o **R-09** já
> mediu como insuficiente; e, para quem o preenchesse, **~4 s de digitação** pela premissa 2 da §2.1.
> Com **7 segundos de folga**, um campo que a maioria deixa vazio e que a minoria paga em 4 é troca ruim.
>
> **E ele passa a valer no dia em que existir o segundo anexo** — porque aí o título distingue *qual*
> foto —, e nesse dia ele entra **sem tocar esquema nem contrato**. Concordo com a decisão do hub, e o
> número acima é a razão.

**O total continua: 53 s no cenário do RNF6, contra 60. Sete segundos de folga, e nenhum foi gasto.**
---

## 3. A lista de Áreas — o que o orçamento fez com ela

**O problema, montado com peças que já estavam na mesa:** um condomínio médio passa de trinta Áreas
(`contrato-de-api.md` §7.7: *"~15, ~30 e ≤ 200 linhas"*); `Area` **não tem `ordem`** no schema, ao
contrário de `Categoria` — o achado **F12** do inventário; a ordenação é alfabética por ausência de
alternativa (**S-T10**); `areaId` é **obrigatório**, porque é dele que a visibilidade deriva; e o campo
está **no caminho crítico do RNF6**. O contrato declarou o custo dessa escolha e disse textualmente que
*"a evidência viria daqui"*.

**A evidência é a linha 7 da §2.2: 12 segundos no caminho típico, 20 no teto.** Um quinto do orçamento
inteiro num campo que não é o conteúdo da ocorrência — é só o endereço dela.

### As quatro saídas, pesadas

| # | Saída | Custo do campo | O que custa em outro lugar |
|---|---|---:|---|
| **(a)** | Seletor alfabético — **o que está hoje** | 12 s | nada. É o piso |
| **(b)** | **Campo com busca**: digitar *"gar"* filtra até *Garagem* | ~4 s | abre o teclado; e **quem não sabe o nome exato da Área não sabe o que digitar** |
| **(c)** | **Usadas recentemente no topo**, o resto alfabético abaixo | ~2 s | exige estado por pessoa **no aparelho**; e **não serve no primeiro registro**, que é justamente o que decide se a pessoa volta |
| **(d)** | **`Area` ganha `ordem`**, como `Categoria` já tem | ~5 s | **campo novo no modelo de dados**, `PATCH /areas` aceitando `ordem`, e reordenação em T-09 |

### A decisão

> **(b) e (c) juntos: um campo com busca, cujo topo é um bloco "Usadas recentemente" e cujo corpo é a
> lista alfabética inteira.** Nenhum dos dois custa campo no modelo de dados, endpoint novo ou requisição
> a mais.
>
> **E (d) segue como proposta ao hub**, porque (b) e (c) **não cobrem o primeiro registro** — e o
> primeiro registro é o único que decide se existe um segundo.

**Onde as "usadas recentemente" moram:** no armazenamento local do aparelho, uma lista curta de
`areaId`. **Não é cache de resposta de API** — a S-T6 do inventário proíbe isso, e com razão —, é
preferência por dispositivo. Um `areaId` velho apontando para uma Área desativada simplesmente não
aparece, porque a lista é sempre cruzada com o `GET /areas` fresco. Perde-se ao trocar de aparelho, e
isso é aceitável.

**O que a decisão custa, declarado:**

- Um campo com busca **abre o teclado**, e a §2.3 acabou de argumentar que trocar de teclado custa. Aqui
  o teclado já está fechado — a área vem depois dos dois campos de texto —, então a troca acontece uma
  vez só, e compra 8 segundos.
- **A busca é por prefixo do nome.** Quem procura *"vaga 34"* não acha *"Garagem"*. O complemento em
  texto livre é o que absorve isso, e é a razão de ele ficar no mesmo bloco.
- **No primeiro registro de uma pessoa o bloco de recentes está vazio**, e o custo volta para ~6 s, o
  piso da busca. É a metade do problema que só (d) resolve.

**Se o hub aprovar (d)**, o efeito é maior do que parece: o Gestor põe *Garagem*, *Hall*, *Elevador* no
topo, e **o primeiro registro de todo mundo fica rápido**, não só o do reincidente. O custo é uma coluna
`ordem` em `areas`, um campo opcional em `PATCH /areas`, e reordenação em T-09 — que **já existe**, para
`Categoria`. É a simetria que o F12 pediu, agora com uma razão de tempo medido por trás.

---

## 4. Os desenhos

### D-1 · T-04 · Registrar ocorrência — celular

> ### → [Ver a tela renderizada](prototipo/telas.html#t04)
>
> **Nove estados, em 390 px, com o conteúdo no pior caso.** A moldura de texto que estava aqui saiu em
> 21/08/2026: onde o HTML existe, o desenho mora nele, porque duas representações da mesma tela divergem
> na primeira alteração — e a divergente é pior que a ausente.
>
> **O que ficou nesta seção é o que a moldura nunca carregou**, e é o que decide: as cinco decisões de
> forma com a razão de cada uma, o que elas desmentem no inventário, e o orçamento de tempo da §2, que é
> a parte mais cara deste documento.

**A tela mais restringida do inventário**, e a única cujo layout é medido em segundos.

#### A · Aberta, teclado fechado

**Cinco decisões de forma, e a razão de cada uma:**

**1 · A foto é o primeiro alvo da tela, e a tela abre sem teclado.** O DG-5 inteiro depende de a foto ser
escolhida cedo, porque é o upload em paralelo que tira 400 KB de dentro do minuto. Foco automático no
título abriria o teclado antes de a pessoa ter visto o formulário, cobriria metade da tela e empurraria
para baixo justamente o passo que precisa acontecer primeiro. **Quem não vai anexar foto toca no título
e o teclado sobe** — um toque, e é o mesmo toque que teria dado de qualquer forma.

**2 · Os dois campos de texto são consecutivos; os dois seletores vêm depois.** Ver §2.3 e §2.5: são duas
trocas de teclado economizadas e até 24 segundos de cold start escondidos.

**3 · Área e Referência vivem num bloco só, chamado "Onde".** Não é agrupamento estético: o glossário
define **Localização** como *"uma referência a uma Área mais um complemento em texto livre"*. Eram um
conceito e estavam desenhados como dois campos soltos. Um conceito, um bloco, um rótulo.

**4 · O campo de descrição abre com duas linhas.** Ele aceita 5.000 caracteres (`openapi.yaml`), e um
campo alto **pede** um parágrafo. É a única alavanca de desenho sobre o passo mais caro do orçamento.

**5 · O botão de registrar fica no fim do conteúdo, não fixo no rodapé.** Fixo, o teclado o cobre — e o
teclado está aberto durante a maior parte do registro. A regra geral: **botão fixo no rodapé onde a tela
rola sem fim (uma lista); botão no fim do conteúdo onde o conteúdo é curto e termina (um formulário).**

> #### O que este desenho desmente no inventário
>
> O inventário decidiu: *"O que aparece sem rolar: `titulo`, `categoria` e o botão de foto. `descricao`,
> `area` e `localizacaoComplemento` vêm abaixo."*
>
> **O desenho entrega foto, título e descrição sem rolar, e a categoria desceu.** As duas coisas não
> podiam ser verdade ao mesmo tempo: pôr a categoria acima da dobra exigia ou reordenar os campos, e
> quebrar a sequência do contrato, ou espremer a descrição. E colocar um seletor **entre** dois campos de
> digitação custa duas trocas de teclado — o teclado descer, a tela reposicionar e ele subir de novo —,
> meio segundo cada, mais o custo de trocar de modo de entrada.
>
> **A evidência está na §2.3 e na §2.5:** a ordem escolhida economiza 1,5 s e esconde até 24 s de cold
> start. A ordem do inventário não faz nem uma coisa nem outra. Achado **P-01**.

#### B · Teclado aberto, descrição em foco — sobra metade da tela

*(estado 3 da [tela renderizada](prototipo/telas.html#t04) — o teclado sobe de verdade ao tocar num campo)*

> **O inventário raciocinou "o que aparece sem rolar" com o teclado fechado.** Com o teclado aberto — que
> é o estado em que a pessoa passa a maior parte do registro — **sobra cerca de metade da tela**. A
> consequência de projeto é uma regra: **o campo em foco, o rótulo dele e o erro dele têm de caber juntos
> acima do teclado.** É o que proíbe pôr a mensagem de erro de um campo em qualquer lugar que não seja
> imediatamente abaixo dele. Achado **P-02**.

#### C · O campo de Área aberto — a decisão da §3

*(estado 4 da [tela renderizada](prototipo/telas.html#t04) — 32 áreas de verdade, com busca e rolagem
de verdade)*

**Sem nada digitado**, o campo abre com *Usadas recentemente* no topo e a lista alfabética inteira
abaixo — o comportamento de quem registra pela segunda vez. **Com texto digitado**, filtra as duas
seções. **No primeiro registro de uma pessoa**, a seção de recentes não existe e o campo é a lista
alfabética com busca: 6 segundos, contra os 12 do seletor puro.

**O `tipo` da Área aparece na linha do item** — *área comum* / *unidade privativa* —, porque é o dado que
decide a visibilidade da ocorrência e o Solicitante não tem outro lugar para vê-lo. Não vai num
*tooltip*: ver a regra de acessibilidade **A-6** da §8.

---

### D-2 · T-03 · Ocorrências — as duas caras, e a terceira

> ### → [Ver a tela renderizada](prototipo/telas.html#t03)
>
> A moldura de texto saiu daqui em 21/08/2026: **onde o HTML existe, o desenho mora nele**. O que ficou
> nesta seção é o que a moldura nunca carregou — as decisões de forma, a razão de cada uma, e o que elas
> desmentem no inventário.


O inventário decidiu que **o alvo primário vem de `visibilidadeAplicada`, que chega na resposta** — não
da largura da janela. Desenhar isso obrigou a separar dois eixos que o inventário tratava como um:

> **O recorte (`visibilidadeAplicada`) escolhe a *densidade do item*. A largura da tela escolhe *quantas
> colunas de layout* existem.** Os dois eixos são independentes, e é isso que faz o Gestor pedindo
> `?autor=eu` numa tela grande não virar uma tela esquisita: ele recebe itens altos numa coluna só, que é
> exatamente o que quer quando está lendo as próprias.

#### A · `apenas_minhas` — celular, o alvo primário do Solicitante

*(estado 1 da [tela renderizada](prototipo/telas.html#t03) — `apenas_minhas` no celular)*

**O rótulo é a primeira linha do item, e é o que fica em destaque.** É a resposta literal à pergunta com
que o Solicitante chega — *"o que aconteceu com o meu pedido?"* —, e os rótulos são **literais** da tabela
do glossário §4: *"Parada — esperando você responder"*, *"Recebida — aguardando análise"*, *"Em execução"*,
*"Resolvida"*. Nenhum deles é montado no cliente.

**Sem `prioridade` e sem `motivoPausa` como campo**: para o Solicitante o motivo já está dentro do rótulo,
e a prioridade é decisão do Gestor.

**O botão de registrar é fixo no rodapé** — a lista rola sem fim, e um botão que rola some.

#### B · `todas` — tela grande, o alvo primário do Gestor

*(estado 2 da [tela renderizada](prototipo/telas.html#t03) — `todas` na tela grande)*

**Quatro decisões, e a última contradiz o inventário:**

**1 · `motivoPausa` é a segunda linha da coluna de status, não uma coluna própria.** O rótulo do Gestor é
sempre *"Pausada"*, e sem o motivo a lista dele mostraria **quatro esperas diferentes com a mesma
palavra** — que é exatamente o que a D8 existe para impedir. Como coluna, ficaria vazio na maioria das
linhas; como segunda linha do status, só ocupa espaço quando existe.

**2 · `registradaEm` e `atualizadaEm` compartilham uma coluna**, uma em cada linha, a segunda marcada por
`↻`. Duas colunas de data numa tabela de triagem é uma coluna a mais para uma leitura que ninguém faz de
relance.

**3 · A barra de filtros é permanente**, com os **três de G2** e o *"Ver as minhas"*. Não há filtro por
área, e não deve haver: o contrato o excluiu deliberadamente (§8.5), e oferecer na tela um filtro que a
API não tem é o começo da divergência.

**4 · A coluna de prioridade não some quando o Gestor pede `?autor=eu`.** O inventário condicionou
`prioridade` a `visibilidadeAplicada == "todas"`, justificando que *"não há nada que o Solicitante faça
com ela"*. Mas a **razão** é sobre o Solicitante e a **regra** é sobre o recorte — e o Gestor que filtra
pelas próprias recebe `apenas_minhas` e **perde a coluna de um campo que ele mesmo altera**. A correção
usa a doutrina do próprio inventário: **prioridade aparece quando `contexto.permissoes` inclui
`ocorrencia.alterar_prioridade`** — permissão, nunca recorte, nunca papel. Achado **P-03**.

#### C · `todas` no celular — o caso que o inventário não cobriu

O inventário diz apenas que *"no celular eles empilham"*. Mas o Gestor da **Persona 1A é o síndico que
mora no prédio** e anda por ele com o celular na mão: ele recebe `todas` numa tela de 390 px, e alguma
coisa tem de cair.

*(estado 3 da [tela renderizada](prototipo/telas.html#t03) — `todas` no celular)*

**O que fica, e por quê:** `statusRotulo`, `motivoPausa`, `prioridade`, `responsavel` e `titulo` — as
**três dimensões de comparação** que o inventário nomeou, mais as duas que identificam a ocorrência.

**O que cai:** `categoria.nome`, que está na barra de filtros e é a dimensão pela qual o Gestor recorta,
não a que ele compara; e a marca de anexo — hoje `quantidadeDeAnexos > 0` —, que só importa depois de
abrir. Três linhas por item,
cinco itens por tela. Achado **P-04**: **a lista do Gestor no celular perde a categoria, e essa decisão
não estava em lugar nenhum.**

> #### O convite a avaliar, o PA-16, e o que dá para fazer dentro do que existe
>
> O problema, montado: `GET /ocorrencias` ordena **só** por `registradaEm DESC` (S-A11), não há filtro de
> *"resolvida e não avaliada"*, o sino é ⬜ e os filtros rápidos são ⬜. **A resolução envelhece, afunda, e
> o convite afunda com ela.** O objetivo **O4** — ≥ 60% das resolvidas avaliadas — fica sem instrumento.
>
> Não é meu para resolver com escopo novo. É meu para desenhar da melhor forma dentro do que existe, e
> para dizer honestamente quanto isso ajuda. **Duas coisas, e a segunda é nova:**
>
> **1 · No item da lista, o convite é um botão dentro do item, ao lado do rótulo** — não uma marca
> discreta. Um item que oferece uma ação tem forma diferente de um item que só informa, e essa diferença
> é visível ao rolar.
>
> **2 · Uma linha de chamada no topo da lista**, quando `visibilidadeAplicada == "apenas_minhas"` e houver
> ao menos uma resolvida não avaliada: *"Você tem 2 resolvidas para avaliar."*, e o toque aplica
> `?status=resolvida`. **Isto não é filtro rápido** — `status` é filtro de G2, `ENUNCIADO · literal`, e
> `resolvida` é um valor dele. É a forma do controle, não capacidade nova. **Custo: zero requisição a
> mais**, porque a contagem sai do que já chegou.
>
> **E a limitação, que é a parte honesta:** a contagem é **da página carregada**, não do total.
> `GET /ocorrencias` não devolve `total` (§7.7) e pagina por cursor — então uma resolvida não avaliada na
> terceira página **não é contada**, e a linha pode dizer *"nenhuma"* quando há. **A mitigação possível é
> limitada pela paginação, não pela tela.** Achado **P-05**.
>
> **Quanto isso ajuda:** pouco, e é preciso dizer. Alcança quem abre o aplicativo; não alcança quem parou
> de abrir. Os dois instrumentos que resolveriam continuam ⬜, e o PA-16 continua aberto.
>
> **Uma nota de texto, que vai como proposta e não como decisão.** O inventário fixou o convite como
> *"Resolvida. Conte como foi."* nos dois lugares. Aplicado literalmente ao item da lista, ele **duplica o
> rótulo que o servidor já mandou** — o item diria "Resolvida" duas vezes, e a segunda montada no cliente,
> o que o contrato §8.8 não quer. Neste desenho o item mostra o `statusRotulo` *"Resolvida"* e o botão diz
> **"Conte como foi"**; em T-05, onde o convite é chamada e não marca, a frase aparece inteira. **É
> mudança de texto de interface, e por isso está na §13 como proposta.**

---

### D-3 · T-05 · Ocorrência — celular, e a gaveta de um comando

> ### → [Ver a tela renderizada](prototipo/telas.html#t05)
>
> A moldura de texto saiu daqui em 21/08/2026: **onde o HTML existe, o desenho mora nele**. O que ficou
> nesta seção é o que a moldura nunca carregou — as decisões de forma, a razão de cada uma, e o que elas
> desmentem no inventário.


**Dezesseis capacidades, onze comandos, quatro requisições.** É a tela que mais decide, e o alcance do
polegar é o que decide se `pausar` é rápido no elevador.

*(estado 1 da [tela renderizada](prototipo/telas.html#t05) — o Gestor, ocorrência pausada)*

**Cinco decisões, e a primeira reordena o inventário:**

**1 · A última mudança sobe para o topo, junto do rótulo e do título.** O inventário pediu que sem rolar
aparecessem *"`statusRotulo`, `titulo`, e a última entrada da linha do tempo"* — mas listou a linha do
tempo como **bloco 3**, depois da identidade e do conteúdo. Os dois não podiam valer ao mesmo tempo. O
desenho **parte o bloco 1**: o rótulo e o título ficam no topo com a `ultimaTransicao`; o resto da
identidade — prioridade, categoria, área, autor, responsável, datas — desce.

E isso compra uma coisa a mais, que é a razão de eu ter escolhido este lado: **`ultimaTransicao` vem
dentro do `OcorrenciaDetalhe`**, então **o topo da tela pinta com uma requisição só**. A linha do tempo
completa e a conversa são duas requisições a mais, e sob cold start (RNF5) esperar as três para pintar
qualquer coisa é esperar três vezes. Achado **P-08**.

**2 · A barra de ações é fixa no rodapé, com um primário e um "Mais ações".** No máximo — Gestor em
`em_atendimento` — `acoesDisponiveis` traz seis comandos, dos quais dois não são botões (`alterar-prioridade`
é seletor no bloco de identidade, `registrar-solucao-aplicada` é campo no corpo). **Sobram quatro
botões, e quatro rótulos legíveis não cabem em 390 px** — *"Iniciar atendimento"* sozinho já não cabe num
quarto da largura. Um primário largo mais um menu resolve, e mantém o primário na zona onde o polegar
chega com uma mão só.

**3 · O Solicitante quase sempre vê um botão só.** Em `aberta` ele tem `cancelar`; em `resolvida`, `avaliar`.
A mesma barra serve os dois papéis sem nenhuma verificação de papel no cliente — ela renderiza
`acoesDisponiveis` e nada mais, exatamente como o inventário decidiu (S-T2).

**4 · O campo de solução aplicada só existe quando o comando existe.** Ele aparece quando
`registrar-solucao-aplicada` está em `acoesDisponiveis`, ou quando `solucaoAplicada` já tem conteúdo — e
nesse caso como texto, não como campo.

**5 · O anexo carrega por último e nunca segura o resto** (decisão do inventário, mantida). Tocar nele abre
em tamanho grande; o `url` de `anexos[]` aponta sempre para `/ocorrencias/{id}/anexos/{anexoId}`, nunca para
o storage.

**E desde 22/08/2026 o lugar da foto não fica cinza esperando:** a **miniatura** de ~15 KB —
`?variante=miniatura`, a mesma URL com outra variante — pinta primeiro, e os ~400 KB entram por cima. É a
única tela onde eu uso a miniatura, e o porquê está no D-2: **na listagem ela custaria uma requisição por
item**, e o custo de leitura não é o mesmo que o custo de upload, que o contrato já pagou.

> #### O que a ordem de `acoesDisponiveis` não diz — achado P-09
>
> A barra precisa saber **qual comando é o primário**. `acoesDisponiveis` é um array e **o contrato não
> declara que a ordem dele significa alguma coisa**. Sem isso, a tela tem duas saídas ruins: ou fixa uma
> ordem em código — uma migalha da máquina de estados no cliente, que é o que o campo existe para
> impedir —, ou põe os comandos na ordem em que chegaram, que pode variar.
>
> **A saída barata já está no YAML:** o schema `Comando` tem os dez valores numa ordem que é a do ciclo
> de vida — `analisar · alterar-prioridade · atribuir-responsavel · iniciar-atendimento · pausar ·
> retomar · registrar-solucao-aplicada · resolver · cancelar · avaliar`. **Recomendação: o contrato
> declara que `acoesDisponiveis` chega nessa ordem, e o primeiro elemento renderizável é o primário.**
> Custo: uma frase no contrato. Ver Q-P3.

#### A gaveta de `pausar` — e o aviso que não pode virar paisagem

*(estado 3 da [tela renderizada](prototipo/telas.html#t05) — a gaveta, com a pré-visualização do texto)*

**Por que gaveta no celular e caixa centrada em tela grande.** São formas diferentes do mesmo comando, e
a diferença é o polegar: uma caixa centrada põe os botões no meio da tela, onde a mão que segura o
aparelho chega mal; a gaveta ancora o conteúdo na borda inferior, que é a zona confortável. **É o comando
`pausar`, feito de pé no elevador, que decide isso** — e é suposição, não medição (S-P4).

##### O aviso de visibilidade — a restrição herdada nº 1

O aviso aparece em **cinco modais**: `pausar`, `cancelar`, `resolver`, `iniciar-atendimento` e `retomar`.
E o problema é exato: **aviso que vira paisagem não avisa — se ele aparecer igual em cinco modais, na
terceira vez ninguém lê.**

A regra que este protótipo adota:

> **O aviso não é uma faixa: é a descrição do próprio campo, ancorada nele. E ao lado dele, o modal mostra
> uma pré-visualização do que a pessoa acabou de escrever, na forma em que o Solicitante vai lê-la.**

**A pré-visualização é o que impede a paisagem, e a razão é mecânica: ela muda todas as vezes.** Um aviso
repetido é sempre o mesmo texto, e o olho aprende a pular o que se repete. Uma pré-visualização carrega
**o texto que a pessoa digitou há três segundos**, com o nome dela em cima — é conteúdo novo em cada uso,
e conteúdo novo não vira paisagem. E ela ataca o erro certo: o Gestor que ia escrever nota interna ali
**vê a nota interna endereçada ao Solicitante antes de confirmar**.

**Custo: zero.** O texto está no cliente, o nome vem de `GET /contexto`, e nada disso custa requisição.

**Uma limitação que o desenho descobriu.** A pré-visualização mostra o **texto**, e não o rótulo de status
que o Solicitante vai ler junto com ele. Não é omissão: `statusRotulo` é calculado no servidor **em função
de quem lê** (§8.8), e **nenhum endpoint devolve o rótulo do outro lado** — o Gestor não tem como obter
*"Parada — esperando material chegar"* em lugar nenhum da API. Montá-lo no cliente seria a segunda cópia
da tabela de rótulos, que é exatamente o que o contrato recusou. **Consequência: a tela do Gestor nunca
pode mostrar exatamente o que o Solicitante lê.** Achado **P-10** — declarado, sem conserto nesta entrega.

**E o agravante continua valendo, escrito onde importa:** a nota interna é ⬜ (D9), então **na primeira
entrega não existe lugar nenhum para texto interno entre Gestores**. O campo de observação é o único campo
de texto livre que um Gestor tem, e ele é público ao Solicitante. É isso que torna o aviso obrigatório, e
não recomendável.

##### O seletor de prioridade — o único controle que merece desfazer

`alterar-prioridade` é um seletor no bloco de identidade, que salva na mudança — decisão do inventário,
mantida. Desenhar isso expôs uma assimetria:

> **É o único comando da tela cuja mudança acontece com um toque só — e é também o único cuja mudança não
> deixa rastro em lugar nenhum.** A alteração de prioridade **não gera registro de transição** (contrato
> §8.4) e **não aparece na linha do tempo** (PA-21). Um toque errado reescreve um valor sem deixar
> vestígio, e nem a trilha nem a linha do tempo podem contar o que aconteceu.

**Decisão:** a mudança de prioridade é a **única** ação do produto que produz uma notificação flutuante, e
ela traz **desfazer** — *"Prioridade alterada para Alta. (Desfazer)"*. Desfazer é o mesmo endpoint com o
valor anterior; como nada foi gravado na trilha, não há nada de inconsistente em voltar atrás.

**Custo:** uma requisição a mais, e só quando alguém desfaz. **O que compra:** o único ponto do produto
onde a última escrita vence sem aviso e sem registro (achado **F7** do inventário) passa a ter uma janela
de conserto.

---

### D-4 · T-06 · Trilha de auditoria — o requisito central do desafio

> ### → [Ver a tela renderizada](prototipo/telas.html#t06)
>
> A moldura de texto saiu daqui em 21/08/2026: **onde o HTML existe, o desenho mora nele**. O que ficou
> nesta seção é o que a moldura nunca carregou — as decisões de forma, a razão de cada uma, e o que elas
> desmentem no inventário.


O inventário herdou daqui uma restrição explícita: *"nenhum dos cinco campos do F5 pode ser escondido por
falta de espaço"*. Desenhar mostrou que **os cinco campos não são cinco colunas**.

#### Tela grande — quatro colunas e uma linha de continuação

*(estado 1 da [tela renderizada](prototipo/telas.html#t06) — a tabela de quatro colunas)*

> **Os cinco campos do F5 não cabem como cinco colunas, e nunca caberiam: quatro são valores curtos e o
> quinto é um parágrafo de até 1.000 caracteres** (`openapi.yaml`, `observacao`). Uma coluna de tabela com
> 1.000 caracteres ou trunca — e truncar a observação é truncar *"a intenção humana declarada no momento
> do comando"*, que é a única coisa que uma auditoria genérica não conseguiria produzir — ou destrói o
> alinhamento de todas as outras.
>
> **A trilha em tela grande é uma tabela de quatro colunas com uma linha de continuação por registro**, e
> é na continuação que moram `observacao`, `motivoPausa` e `motivoCancelamento`. Nenhum campo escondido,
> nenhum campo truncado. Achado **P-07**.

**Vocabulário cru, de propósito:** `em_analise`, `aguardando_peca`. É a única tela do produto que mostra
nome interno, e é assim porque **auditoria que traduz não é auditoria**.

#### Celular — o mesmo registro empilhado, com os cinco campos inteiros

*(estado 3 da [tela renderizada](prototipo/telas.html#t06) — o registro empilhado no celular)*

**Cada campo com o nome dele à esquerda.** É verboso, e é assim de propósito: quem lê esta tela está
provando algo, e prova sem rótulo de campo é afirmação.

**Nenhuma ação, em nenhuma das duas larguras** — é a expressão de interface da invariante *"o histórico é
append-only"*. **Um estado vazio aqui é defeito, não estado** (premissa P1): se esta tela aparecer vazia,
a invariante 2 da ADR-0001 foi violada, e a tela deve dizer isso com essas palavras, para que o defeito
não seja lido como ausência de dados.

---

### D-5 · T-07 · Dashboard — cinco indicadores sem virar painel de aeroporto

> ### → [Ver a tela renderizada](prototipo/telas.html#t07)
>
> A moldura de texto saiu daqui em 21/08/2026: **onde o HTML existe, o desenho mora nele**. O que ficou
> nesta seção é o que a moldura nunca carregou — as decisões de forma, a razão de cada uma, e o que elas
> desmentem no inventário.


*(estado 1 da [tela renderizada](prototipo/telas.html#t07) — os cinco indicadores)*

**Cinco decisões, e as duas primeiras são o que impede o painel de aeroporto:**

**1 · A recorrência ocupa a largura inteira, tem número de ordem e é a única com gráfico.** Os outros
quatro são números com barra. *"Cinco números com o mesmo peso visual comunicam zero"* — e a hierarquia
não se faz com cor, que é o passo seguinte: faz-se com **tamanho, posição, e o fato de só um deles ter
uma frase explicando por que existe**.

**2 · `recorrenciaPorArea` não é gráfico, é lista ordenada — e isso contradiz o formato.** O contrato
devolve `recorrenciaPorArea` com a mesma forma de `recorrenciaPorCategoria`: uma série mensal por item.
Mas são **~30 áreas contra ~7 categorias** (§7.7): um gráfico de trinta séries não tem legenda possível e
não é lido por ninguém. **A lista ordenada pelo total do período responde à pergunta real — *onde é que
isso acontece mais* —, e a série mensal fica disponível ao abrir uma área.** Sete séries num gráfico
funcionam; trinta não. Achado **P-11**.

**3 · Cada bloco carrega uma palavra: `agora` ou `no período`.** As duas coisas que a tela é obrigada a
dizer — *"backlog é fotografia de agora; recorrência e tempo médio são séries dentro da janela"* — não
podem ser um parágrafo no rodapé, porque quem lê um número não desce até o rodapé antes. **Duas palavras
repetidas em cada bloco dizem mais do que uma explicação em lugar nenhum.**

**4 · O denominador nunca sai do lado da média.** *"6 de 14 resolvidas avaliadas"* fica na mesma altura
visual do 4,2, não abaixo dele como nota de rodapé. É o **PA-16** e a frase do contrato: *"sem o
denominador, a média mente quando poucos avaliam"*. O mesmo vale para `resolvidas` ao lado de `horas`.

**5 · O mês sem resolução continua na série, com a lacuna visível.** *"jul — (0 resolvidas)"*. O contrato
é explícito: *"buraco na série é informação, e omitir o mês faria a linha do gráfico mentir"*.

**O que a tela não mostra, com o motivo escrito:** **tempo de calendário × tempo ativo** é ⬜ (D19), o
objetivo **O5 não é medido na primeira entrega**, e **não há espaço reservado prometendo**. A única menção
é a linha *"Tempo de calendário, com as pausas."*, que diz o que o número **é** sem insinuar o que ele não
é.

**Zero dados não é estado vazio** (decisão do inventário, mantida): a estrutura aparece com zeros, porque
ela ensina o que vai ser medido. **Com uma exceção**: `recorrencia` vazia mostra *"A recorrência aparece a
partir do segundo mês de uso."*, porque um gráfico com um ponto não é tendência.

**No celular** os cinco empilham na ordem numerada, a recorrência fica visível sem rolar, e o gráfico de
barras vira a mesma lista ordenada que a área já usa — **um gráfico de 390 px com três meses e sete
categorias não é legível, e fingir que é seria o oposto do que este passo existe para fazer.**

---

### D-6 · T-08 · A aprovação do pedido de entrada — onde a forma previne o defeito

> ### → [Ver a tela renderizada](prototipo/telas.html#t08)
>
> A moldura de texto saiu daqui em 21/08/2026: **onde o HTML existe, o desenho mora nele**. O que ficou
> nesta seção é o que a moldura nunca carregou — as decisões de forma, a razão de cada uma, e o que elas
> desmentem no inventário.


O **PA-25** nasceu de um erro de clique num `select`. O conserto existe — `DELETE /vinculos/{pessoaId}` —,
mas conserto é remendo: o conserto é do Gestor, e quem precisa saber que deve procurá-lo é a pessoa
aprovada com o papel errado, que se caiu em `encarregado` **não consegue fazer nada** (T-10).

*(estado 1 da [tela renderizada](prototipo/telas.html#t08) — o bloco de aprovação)*

E a confirmação, que é onde o papel vira palavra:

*(estado 2 da [tela renderizada](prototipo/telas.html#t08) — a confirmação)*

**Cinco decisões, e três delas vêm literalmente do inventário:**

**1 · Escolha única em lista aberta, não seletor fechado.** As três opções e as três consequências ficam
**visíveis ao mesmo tempo**, e não escondidas atrás de um controle que se abre. O mecanismo do PA-25 foi
um clique num controle onde as opções não estavam à vista.

**2 · Nenhum papel pré-selecionado, e o botão de aprovar indisponível até haver escolha.** *"Não existe
papel que se obtém por não escolher."* — **e este é o único botão desabilitado deste protótipo.** Não
contradiz a S-T2 do inventário: aquela regra é sobre **comando do agregado ausente de `acoesDisponiveis`**;
este é um formulário incompleto, que é outra coisa.

**3 · A consequência está escrita onde a escolha é feita**, uma linha por papel, com as frases literais do
inventário.

**4 · O Encarregado fica por último e separado por uma régua.** É decisão de desenho, e a razão é de
domínio: **quem chega por `POST /pedidos-de-entrada` é quem digitou o código do cartaz do elevador — quase
sempre um morador.** O Encarregado normalmente entra por `POST /vinculos`, cadastrado pelo Gestor, e sem
conta. Um papel raro no meio de dois comuns é alvo de clique acidental; um papel raro separado e com o
aviso em caixa alta é uma decisão que se toma de propósito.

**5 · A confirmação diz o papel em palavras, repete a consequência e acrescenta a irreversibilidade.** A
terceira frase — *"O papel não pode ser alterado depois"* — é o que o inventário e o **DG-4 (lacuna L-6)**
já sabiam e a tela não dizia.

**O remover, que é o conserto, também é difícil de errar:** o botão só aparece quando o vínculo pode sair;
quando não pode, **a razão substitui o botão** (§6.2). E a confirmação diz o que sobra: *"Remover o vínculo
de Camila Duarte. O cadastro da pessoa não é apagado, e ela pode pedir entrada de novo."*

---

## 5. As sete telas descritas — regiões, ordem e ênfase

Nenhuma das sete tem decisão de layout que mude alguma coisa. O que decide, nelas, é **qual conteúdo
aparece quando** — e isso é tabela, não desenho.

### As quatro da credencial — T-01, T-11, T-12, T-13

**Eram uma até 21/08/2026**, e a razão de terem virado quatro está no inventário: a tela declarava três
ações e especificava um formulário. Aqui interessa o que isso muda de **forma**, e a resposta é pouco —
**exceto em dois pontos, que são os únicos desta seção que mereceriam ser errados de propósito para se
ver o estrago.**

**A estrutura é a mesma nas quatro:** o nome do produto, discreto; o formulário, que **é** o conteúdo e
cabe sem rolar; e abaixo, os caminhos para as irmãs. **Nada da organização em nenhuma delas** — a
identidade da organização na página de cadastro é ⬜ (D25), então as quatro são as mesmas para todo
mundo. **Espera:** botão em estado de espera, e **nunca a frase do RNF5**, porque nenhuma toca a nossa
API. **Alvo primário: celular**, nas quatro.

| Tela | Campos, na ordem | O caminho de saída | A frase que decide |
|---|---|---|---|
| **T-01 · Entrar** | e-mail · senha | Criar conta → T-11 · Esqueci a senha → T-12 | *"E-mail ou senha incorretos."* — **uma linha só, acima do formulário**, sem distinguir e-mail inexistente de senha errada |
| **T-11 · Criar conta** | **nome** · e-mail · senha | Já tenho conta → T-01 | *"Enviamos um e-mail para {e-mail}. Toque no link para confirmar a conta."* — e a tela **não finge que a pessoa entrou** |
| **T-12 · Redefinir senha** | e-mail | Voltar → T-01 | *"Se existe uma conta com este e-mail, o link foi enviado. Confira também o spam."* |
| **T-13 · Definir nova senha** | senha nova | **quando o link venceu** → T-12 | *"Este link expirou. Peça um novo."* |

**Os dois pontos de forma que não são triviais:**

**1 · Em T-11, o `nome` é o primeiro campo, e a regra de senha aparece antes de digitar.** A ordem não é
estética: o `nome` é o campo que fecha o **F6** e é o que vai para a **trilha de auditoria imutável**.
Pô-lo por último, depois de e-mail e senha, é pô-lo onde se preenche no automático — e é o único dos
três que ninguém pode corrigir depois (**F11**). E a regra de força da senha **dita antes** evita o modo
de falha mais comum de um cadastro: a pessoa escolhe, envia, e descobre a regra como erro.

**2 · Em T-13, o caminho de saída do link vencido não é opcional.** É a tela alcançada **só de fora**,
por um e-mail lido quando é lido, possivelmente dias depois e em outro aparelho — o link vencido não é
caso raro, é o caso provável. Sem o caminho de volta a T-12, a tela é um beco. **É o mesmo defeito que a
face C de T-02 foi corrigida para não ter**, e é a regra geral que já vale nos dois lugares: *nenhuma
tela de recuperação termina sem caminho de volta.*

**E a que não é tela:** a aterrissagem do e-mail de **confirmação de conta** é uma linha acima do
formulário de T-01 — *"Conta confirmada. Entre para continuar."* Zero campos, e a única ação é entrar.

### T-02 · Sem organização ativa — quatro faces, uma tela

A face é escolhida por `GET /contexto`, e a estrutura é a mesma nas quatro: **um título curto, um
parágrafo, e no máximo um campo.**

| Face | Quando | Título | O que fica abaixo | Ênfase |
|---|---|---|---|---|
| **A · Entrar em uma organização** | `vinculos: []` e `pedidosDeEntrada: []` | *"Você ainda não está em nenhuma organização."* | campo do **Código da Organização** e, **separado por uma régua**, o caminho de criar uma organização | o campo do código é o primário; criar é o secundário, porque **quem chega aqui quase sempre está entrando, não fundando** |
| **B · Esperando aprovação** | pedido `pendente` | *"Seu pedido para entrar em Recanto Azul está aguardando a decisão de um Gestor."* | **e a frase que a ausência de notificação obriga:** *"Você não será avisado automaticamente — volte aqui para ver."* | a segunda frase tem o **mesmo peso** da primeira; enterrá-la produz uma pessoa que espera para sempre |
| **C · Pedido recusado** | pedido `recusado` | *"Seu pedido para entrar em Recanto Azul não foi aprovado."* | o campo do código **de novo** — pedido recusado pode ser refeito (S-A12) | sem o campo, a face C é um beco |
| **D · Escolher a organização** | dois ou mais vínculos, nenhum ativo | *"Em qual organização você quer trabalhar?"* | a lista de `contexto.vinculos`: `nome` e `papel`, um por linha | é a Persona 1B; nada mais, porque **não há endpoint que dê contagem sem organização ativa** |

**É aqui que o cold start aparece pela primeira vez** — ver §6.1. **Alvo primário: celular**, porque quem
digita o código do cartaz está no elevador. O campo do código aceita `^[A-Z0-9]{6,12}$`, e a decisão de
forma é uma só: **maiúsculas automáticas e teclado alfanumérico**, porque o código vem de um cartaz e
ninguém digita maiúscula de propósito com uma mão.

**E a face A ganhou dois campos em 22/08/2026, os dois opcionais e os dois com peso desproporcional ao
tamanho.** `nome`, **pré-preenchido com o nome atual** — o contrato §8.2 declarou que este é o **último
momento em que ele é corrigível**, e depois dele o nome vai para a trilha imutável; e `telefone` **em
E.164**, que vira o primeiro contato da Pessoa. **A ajuda do campo de nome diz onde ele vai aparecer**, e
não é firula: é a única chance que a pessoa tem de saber que aquilo é permanente.

### T-09 · Categorias e áreas

**Duas listas editáveis, lado a lado em tela grande, empilhadas no celular.** Categorias primeiro, na
ordem de `ordem`; Áreas depois, alfabéticas. É trabalho de escritório, feito sentado, uma vez.

**O que carrega informação aqui não é o layout: são cinco frases, e o gatilho de cada uma.**

| Gatilho | Onde a frase aparece | Texto |
|---|---|---|
| A tela abre, organização recém-criada | acima da lista de categorias | *"Sete categorias foram criadas junto com a organização."* — sem ela, o Gestor não sabe se as encontrou ou se alguém as digitou |
| A tela abre | acima da lista de áreas, sempre visível | *"Área comum — garagem, hall, salão. Unidade privativa — apartamento, sala, loja."* **Nunca num *tooltip*** — ver A-6 |
| Ao desativar qualquer item | na confirmação | *"Desativar não apaga. As ocorrências já registradas continuam apontando para esta {categoria \| área}, e ela deixa de aparecer no formulário de registro."* |
| Ao desativar o **último item ativo** de qualquer das duas listas | na confirmação, com peso maior | *"Sem nenhuma {categoria \| área} ativa, ninguém consegue registrar ocorrência."* — **é a única configuração desta tela que quebra outra tela** |
| Ao mudar o `tipo` de uma Área, **depois** do `PATCH` | ao lado da área alterada, usando `ocorrenciasComTipoAnterior` | *"{N} ocorrências já registradas mantêm o tipo anterior. Mudar o tipo vale de agora em diante — o passado não muda."* |

**A última é a mais importante da tela**, e a razão está no contrato: `ocorrenciasComTipoAnterior` é *"um
campo de resposta que só existe para produzir uma frase de tela"*. **Deixar de produzi-la desperdiça a
decisão inteira** — e produz um Gestor que reclassifica uma área esperando que a visibilidade do passado
mude, e ela não muda.

**Não há apagar, e é a ausência do botão que diz isso** — não uma mensagem depois do clique.

### T-10 · Vínculo sem permissões

**A tela é o texto, e o texto é a tela.** Três parágrafos, na ordem em que o inventário os fixou, com o
mesmo peso visual — **nenhum deles é nota de rodapé**, e o terceiro em particular não pode ser, porque é
o único caminho de conserto que existe:

1. *"Você entrou em **Recanto Azul** como **Encarregado**."* — **onde** ela está e **como o quê**.
2. *"Nesta versão do Resolve Aí, o Encarregado não tem acesso próprio ao sistema: você aparece como
   responsável pelas ocorrências que lhe forem atribuídas, e recebe o trabalho fora do aplicativo."* — é
   assim **de propósito**, e não que o aplicativo quebrou.
3. *"**Se isto está errado** — se você deveria poder registrar ocorrências —, fale com um Gestor da
   organização. Ele pode desfazer este vínculo, e você pede entrada de novo com o papel certo."*

Abaixo, no máximo duas ações: **trocar de organização** (só se `contexto.vinculos` tiver outra) e **sair**.
**Nenhum botão de "pedir permissão"**, porque não existe endpoint que o atenda — e um botão que abre um
cliente de e-mail prometeria um caminho que o produto não tem.

**Sem endereço próprio**: é um estado, não um lugar. O shell a renderiza no lugar do destino pretendido.

---

## 6. Os estados de projeto — espera, erro e rede

### 6.1 Cold start: esqueleto, indicador ou texto que explica?

**Os três, e a decisão é a sequência temporal.** O RNF5 declara o cold start como **fato de projeto, não
imprevisto** — e a maioria dos protótipos simplesmente o ignora.

| Tempo desde a requisição | O que a tela mostra | Por quê |
|---|---|---|
| 0 até ~0,6 s | **nada** | pintar um esqueleto para uma resposta que chega em 300 ms é piscar, e piscar lê-se como defeito |
| ~0,6 s até ~2 s | **esqueleto com a forma da tela** | a forma da lista já é informação: o esqueleto diz *"vem uma lista"*, e preserva o lugar |
| ~2 s em diante | o esqueleto **permanece**, e abaixo dele aparece *"Acordando o servidor — a primeira abertura do dia é mais lenta."* | um giro de oito segundos sem explicação lê-se como defeito; o RNF5 declara a espera como esperada |
| além de ~15 s | **nada muda** | o texto **não promete prazo**, e é por isso que ele serve também para o banco pausado depois de 7 dias |

**Por que não um indicador girando:** o giro diz *"algo acontece"*; o esqueleto diz *"vem uma lista"*. Num
produto cujo usuário *"não vai aprender nada"*, a diferença é entre esperar e desistir.

> **Uma regra do inventário que o desenho do estado de espera não sustenta.** O inventário diz: *"A
> primeira requisição de uma sessão tem espera nomeada. As seguintes têm estrutura de espera silenciosa."*
> Mas uma sessão pode ficar aberta a manhã inteira, e a requisição das 14h **também é fria** — o serviço
> escala a zero por ociosidade, não por sessão. A regra por **ordem** não captura isso; a regra por
> **tempo** captura, é mais simples de implementar e não tem exceção: **qualquer requisição que passe de
> ~2 s ganha o texto.** Isso também torna desnecessária a exceção que o inventário abriu para T-07 (*"a
> única tela a merecer a frase mesmo não sendo a primeira"*), porque ela deixa de ser exceção. Achado
> **P-12**, e Q-P4.

### 6.2 Onde os erros aparecem — a regra que separa os três casos

> **Erro que tem um campo → mensagem no campo.**
> **Erro que muda o que a tela pode fazer → bloco na página.**
> **Erro que a tela conserta sozinha, sem nada a fazer → notificação flutuante.**

| Erro | Onde | Por quê |
|---|---|---|
| `FORMATO_INVALIDO` (400) — vem com `erros[]` de `{campo, codigo, mensagem}` | **no campo** | o contrato já entrega a mensagem por campo; espalhá-la numa faixa desperdiçaria a estrutura |
| `CODIGO_PUBLICO_NAO_ENCONTRADO` (404) · T-02 | **no campo** | *"Nenhuma organização usa este código. Confira as letras e os números."* Tem campo, e a ação é corrigi-lo |
| `CATEGORIA_INVALIDA` · `AREA_INVALIDA` (422) · T-04 | **no campo**, com a lista recarregada e o resto do formulário intacto | *"Esta {categoria \| área} não está mais disponível. Escolha outra."* |
| `ANEXO_NAO_RECONHECIDO` · `ANEXO_ACIMA_DO_LIMITE` (422) · T-04 | **no campo da foto** | *"A foto não chegou ou a autorização expirou. Escolha a foto de novo — o resto do que você escreveu está aqui."* **A segunda metade é o conteúdo**: perder o texto por causa da foto é o modo de falha que faz alguém voltar para o WhatsApp |
| **`ANEXO_JA_REIVINDICADO` (409) · T-04** | **bloco na página, substituindo o formulário** | **É o único erro do produto que anuncia um sucesso**, e por isso não cabe em campo nenhum: *"Esta ocorrência já foi registrada — a foto que você anexou já está nela."* + **[Ver a ocorrência]**. O `POST` anterior comitou e só a resposta se perdeu; oferecer *"tentar de novo"* aqui produziria a segunda ocorrência que este erro existe para impedir. Ver a releitura da **S-T7** no inventário |
| `CONTATO_DUPLICADO` (409) · T-08 | **no campo do contato repetido** | *"Este contato já está na lista."* Tem campo, e a ação é corrigi-lo |
| `FORMATO_INVALIDO` (400) de telefone · T-08 | **no campo do número** | *"Não reconheci este número. Confira o DDD."* O banco exige **E.164** e o schema pega antes do domínio — mas a pessoa digitou no formato nacional, então a frase fala do que ela vê, não do formato que vai ser guardado |
| `FORMATO_INVALIDO` (400) de `temWhatsapp` em e-mail · T-08 | **não aparece** | É defeito, não caminho: a caixa de WhatsApp **só existe** quando o tipo é telefone. Se este erro chegar, a tela falhou antes |
| `TRANSICAO_NAO_PERMITIDA` (409) · T-05 | **bloco na página**, imediatamente acima da barra de ações | *"Esta ocorrência mudou enquanto você estava olhando: agora ela está **Em atendimento**."* — **e as ações abaixo já são as novas**, que vêm no corpo do próprio `409`. Uma notificação flutuante seria errado: ela some, e o que mudou fica |
| `RESPONSAVEL_NAO_ATRIBUIDO` (409) · T-05 | **bloco na página** + abre o modal de atribuir | muda o que a tela pode fazer |
| `PEDIDO_JA_DECIDIDO` · `JA_AVALIADA` (409) | **bloco na página** + recarrega | idem |
| `ERRO_INTERNO` (500) | **bloco na página**, com o `traceId` **visível e copiável** | é a única coisa que liga a tela à linha de log, e é o que compensa a decisão do `404` da §6.3 do contrato |
| `PERMISSAO_INSUFICIENTE` (403) por link recebido | **bloco na página inteira** + volta a T-03 | não é erro de campo nem some sozinho |
| `ORGANIZACAO_DIVERGENTE` (409) | **notificação flutuante** | *"Esta aba estava em outra organização. Recarregando…"* — a tela **se conserta sozinha** e o usuário não tem nada a fazer. **É o único erro do produto em que a flutuante é a resposta certa** |
| `VINCULO_COM_HISTORICO` · `ULTIMO_GESTOR` (409) · T-08 | **não aparecem como erro**: a razão substitui o botão | a tela não mostra o botão quando o vínculo não pode sair — o erro só existiria se a tela tivesse falhado antes |
| `LIMITE_DE_AUTORIZACOES_DE_UPLOAD` (429) | **no campo da foto** | tem campo, e a ação é esperar |
| `SEM_ORGANIZACAO_ATIVA` (403) · `NAO_AUTENTICADO` (401) | **não têm frase** — levam a T-02 e a T-01, guardando o destino | são navegação, não erro |

> **A notificação flutuante quase não tem uso neste produto, e descobrir isso é resultado do desenho.**
> Todo comando devolve `OcorrenciaDetalhe` **com o estado novo**, e a tela o pinta — então uma
> notificação dizendo *"pausada com sucesso"* ao lado de uma tela que já diz *"Pausada"* é ruído puro.
> **Regra: não há confirmação flutuante de sucesso onde a tela já mostra o resultado.** Sobram exatamente
> dois usos: o `ORGANIZACAO_DIVERGENTE` acima e o **desfazer da prioridade** (D-3), que é justamente o
> único comando cujo resultado a tela mostra mas cujo **registro** não existe. Achado **P-13**.

### 6.3 A rede caindo no meio do registro — o cenário que o RNF6 garante

Registrar em rede móvel, no subsolo, **é** o cenário do RNF6 acontecendo. As decisões do inventário são
mantidas, e o desenho acrescenta onde cada uma aparece:

| Situação | Onde aparece | Texto |
|---|---|---|
| Sem conexão | **faixa persistente no topo**, abaixo do cabeçalho, enquanto durar | *"Sem conexão."* — e **as ações que escrevem ficam indisponíveis**, em vez de falharem |
| `POST /ocorrencias` falhou por rede, dentro dos 15 minutos | **no botão de registrar** | o botão volta ao estado normal; a mesma `chave` + `ticket` são reenviados, e **a foto não sobe duas vezes** |
| Passados os 15 minutos, `ticket` morto | **no campo da foto** | *"A foto expirou. Escolha a foto de novo — o resto do que você escreveu está aqui."* |

**O que isso não é:** uma fila de escrita offline. Não há repetição automática em segundo plano, o botão
de enviar continua sendo do usuário, e o desfazer do toque duplo é o cancelamento com motivo
`aberta_por_engano`.

---

## 7. O mapeamento para `shadcn/ui`

A interface será construída em **`shadcn/ui` sobre Radix, com Tailwind** — decisão de 20/08/2026,
registrada na tabela de tecnologias da [`arquitetura.md`](arquitetura.md) §2. Isso permite que este
protótipo deixe de ser figura e passe a ser **plano de implementação**: quem for codar não redecide nada.

**A regra que impede isso de virar armadilha, e que foi seguida:**

> **A interação foi decidida primeiro; o componente foi nomeado depois.** Nenhuma linha da tabela abaixo
> existe porque o componente existe. Onde **nenhum** componente serviu, isso não virou problema do
> desenho — virou informação sobre a biblioteca, e está na §7.2.

**Verificação, com método e data.** A lista de componentes foi conferida contra a **documentação oficial
em `ui.shadcn.com/docs/components`, consultada em 20/08/2026**, e as páginas de `Drawer`, `Field`, `Empty`
e `Chart` foram lidas individualmente. **O que não consegui confirmar está marcado ⚠️ e não é afirmado.**

### 7.1 Componente por interação

| Interação decidida | Componente | Verificado |
|---|---|---|
| Rótulo associado ao controle, ajuda e erro por campo | **`Field`** (`FieldLabel` · `FieldDescription` · `FieldError`) | ✅ — a doc confirma `htmlFor` ↔ `id` e `aria-invalid` |
| Agrupar Área + Referência sob "Onde" (D-1) | **`FieldSet` + `FieldLegend`** | ✅ |
| Texto de uma linha — título, referência, código da organização | **`Input`** | ✅ |
| Texto longo — descrição, observação, solução aplicada, comentário | **`Textarea`** | ✅ |
| Escolher categoria — 7 a 15 itens, ordem do Gestor | **`Select`** | ✅ |
| **Escolher área — ~30 itens, o campo caro do RNF6** | **`Combobox`** (`Popover` + `Command`) | ✅ — os três estão no catálogo |
| **Escolher a unidade do vínculo — a mesma lista de Áreas, em T-08** | **`Combobox`**, o mesmo de T-04 | ✅ · e é reuso de propósito: duas listas de Área com comportamentos diferentes seriam duas coisas para manter |
| **Sub-formulário repetível de contatos (T-08)** | **`FieldSet` + `FieldLegend`** por contato, dentro de uma lista que o cliente gerencia | ⚠️ **não há componente de lista repetível no catálogo** — ver §7.2, item 5 |
| Tipo e finalidade do contato, 2 e 3 valores | **`Select`** | ✅ |
| `temWhatsapp` — indicação sobre um número | **`Checkbox`**, **sempre com a palavra ao lado** | ✅ · A-5 |
| **Telefone em E.164, com país padrão BR** | **`Input`** + prefixo de país em **`Select`**, e normalização no cliente | ⚠️ **não há componente de telefone**, e a normalização exige biblioteca — ver §7.2, item 6 |
| Reordenar contatos — subir e descer | **`Button`** com rótulo textual, **não** arrastar | ✅ · arrastar é hostil no celular e invisível em low-fi |
| Motivo de pausa (4) e de cancelamento (4 ou 7), nenhum pré-selecionado | **`RadioGroup`** | ✅ |
| Papel na aprovação (3), com consequência por linha (D-6) | **`RadioGroup`** + `FieldDescription` por opção | ✅ |
| Comando com texto — **celular** | **`Drawer`** | ✅ |
| Comando com texto — **tela grande** | **`Dialog`** | ✅ |
| O mesmo comando nas duas larguras | **padrão "responsive dialog"**: `Dialog` em tela grande, `Drawer` no celular | ✅ — **documentado pelo próprio shadcn/ui**, na página de `Drawer` |
| Confirmação de ato irreversível — aprovar papel, remover vínculo, desativar categoria | **`AlertDialog`** | ✅ |
| "Mais ações" no celular (D-3) | **`DropdownMenu`** | ✅ |
| Ações lado a lado em tela grande | **`ButtonGroup`** | ✅ |
| Espera com a forma da tela (§6.1) | **`Skeleton`** | ✅ |
| Progresso do upload da foto, sem bloquear o formulário | **`Progress`** | ✅ |
| Estado vazio — organização nova, filtro sem resultado, conversa sem mensagem, nenhum pedido | **`Empty`** (`EmptyTitle` · `EmptyDescription` · `EmptyContent`) | ✅ — a doc confirma as partes |
| Bloco de erro na página (§6.2) | **`Alert`** | ✅ |
| Faixa persistente de "sem conexão" | **`Alert`** fixado no topo — não há componente de faixa | ⚠️ improvisado |
| Notificação flutuante — os dois únicos usos (P-13) | **`Toast`** | ✅ no catálogo · **`Sonner` não aparece na lista atual** ⚠️ |
| Trilha de auditoria em tela grande (D-4) | **`Table`** | ✅ |
| Lista de ocorrências em tela grande (D-2) | **`Table`** — **não `DataTable`** | ✅ · ver a nota abaixo |
| Gráfico da recorrência por categoria (D-5) | **`Chart`** | ✅ — **e é dependência a mais**: envolve **Recharts** |
| Rótulo de status, prioridade e motivo de pausa | **`Badge`**, **sempre com a palavra dentro** | ✅ · ver A-5 |
| Menu de troca de organização ativa, no cabeçalho | **`DropdownMenu`** | ✅ |
| Navegação do Gestor em tela grande | **`Sidebar`** | ✅ |
| Contagem de pedidos pendentes no item de menu (F10 do inventário) | **`Badge`** dentro do item | ✅ |
| Ver a foto em tamanho grande | **`Dialog`** | ✅ |
| Régua entre grupos — o separador antes do papel Encarregado (D-6) | **`Separator`** | ✅ |
| Agrupamento dos blocos do dashboard | **`Card`** | ✅ |

**Sobre `Table` e não `DataTable`.** `DataTable` existe no catálogo, e traz **TanStack Table**: ordenação
por coluna, seleção múltipla e paginação por página numerada. **Os três são coisas que este produto não
tem** — a ordenação é fixa em `registradaEm DESC` (S-A11), não há seleção nem ação em lote (decisão do
inventário), e a paginação é por **cursor**, sem `total`. Adotar `DataTable` traria uma dependência para
oferecer três affordances que a API recusa, e a primeira consequência seria uma tela oferecendo ordenação
por coluna que o servidor não sabe fazer. **É o exemplo mais claro de catálogo projetando no lugar de
quem desenha.**

### 7.2 As interações sem componente adequado — informação sobre a biblioteca

**1 · A nota de 1 a 5 da avaliação.** **Não há componente de nota no catálogo.** A saída é um `RadioGroup`
de cinco opções rotuladas *1* a *5*, com legenda nas pontas — *"1, muito ruim"* e *"5, muito bom"*.
**Ganha-se acessibilidade de graça** — é o controle certo semanticamente, com teclado e leitor de tela
funcionando — e **perde-se reconhecimento**: as pessoas esperam estrelas. Como o objetivo **O4** depende
de a avaliação ser fácil, isso é custo real, e é candidato natural ao que o artefato clicável mediria.

**2 · "Carregar mais" por cursor.** O `Pagination` do catálogo é **numerado** e pressupõe `total` e
offset — os dois **deliberadamente recusados** pelo contrato (§7.7). O controle é um `Button` simples ao
fim da lista. **Não é problema:** é informação de que a biblioteca assume um modelo de paginação que a
nossa API não tem, e de que a peça de catálogo com esse nome não serve.

**3 · A faixa de "sem conexão".** Não há componente. Um `Alert` fixado no topo resolve, e a decisão fica
declarada como improviso, não como escolha de catálogo.

**4 · `Tooltip` não é opção neste produto.** Ele existe e funciona — **com cursor**. T-04 é
celular-primeiro e não há cursor: **toda explicação que só existisse num tooltip desapareceria para o
usuário principal.** É a regra **A-6** da §8, e é o que obriga a explicação de *"área comum × unidade
privativa"* a ser texto visível em T-09 e a aparecer na própria linha do item em T-04.


**5 · Lista repetível de contatos.** **Não há componente de *array field* no catálogo.** A saída é um `FieldSet` por item, dentro de um contêiner que o cliente adiciona e remove — a integração de formulário que o shadcn/ui recomenda (`react-hook-form`) tem `useFieldArray` para isso, mas **isso é da biblioteca de formulário, não do catálogo de componentes**. Vale registrar porque a diferença aparece na hora de instalar: não existe `add contact-list`.

**6 · Telefone em E.164.** **Não há componente de telefone**, e o problema não é o componente: é a **normalização**. Transformar `(11) 98888-4321` em `+5511988884321` depende de país padrão, regra de discagem nacional e validade do número — o modelo de dados é explícito de que expressão regular não cobre isso e nomeia a `libphonenumber`. **É a segunda dependência de terceiro que este protótipo encosta**, depois do gráfico. Diferença importante: o gráfico era conveniência e saiu; esta é a única forma de produzir o formato que o `CHECK` do banco exige. **Vai como proposta na §13, não como decisão.**

### 7.3 O que a verificação do catálogo revelou — e que não é sobre o desenho

Três coisas apareceram ao conferir a documentação, e as três tocam decisões já registradas em outro
documento. **Vão como proposta na §13; não alterei nada.**

- **O `Form` não é mais um componente do catálogo.** A `arquitetura.md` §2 justifica o `shadcn/ui`
  dizendo que *"o `Form` dele é `react-hook-form` + `zod`"*. Na documentação consultada em 20/08/2026, a
  página de formulário apresenta **guias de integração** — React Hook Form, TanStack Form, Formisch — e o
  par acessível rótulo/erro é o **`Field`**. **A justificativa continua válida** (o schema que valida o
  formulário pode continuar sendo o mesmo que gera o `openapi.yaml`), mas **a peça mudou de nome e de
  natureza**, e a frase da arquitetura vai envelhecer mal na mão de quem for implementar.
- **O catálogo hoje oferece mais de uma base.** A página de `Toast` documenta variantes sobre **Base UI**,
  **React Aria** e **Radix**, e a de `Drawer` diz que ele passou a ser **Base UI**, substituindo a
  implementação anterior. A decisão do projeto é *"shadcn/ui **sobre Radix**"* — o que hoje **precisa ser
  escolha explícita na hora de adicionar cada componente**, ou a base vem misturada. Isso não invalida a
  decisão; obriga a torná-la operacional.
- **O `Chart` é dependência a mais, e é a única deste protótipo.** A `arquitetura.md` argumenta que
  `shadcn/ui` *"não é dependência — o CLI copia o código para o repositório"*. Verdade para os outros
  vinte e tantos componentes; **falsa para o `Chart`, que copia o invólucro e traz o Recharts para o
  `package.json`**. É um gráfico, num indicador, numa tela. **Se o hub decidir que não vale, a saída é a
  mesma que a D-5 já aplicou à recorrência por área e ao celular: barras compostas de blocos, sem
  biblioteca nenhuma** — feio, e suficiente.

---

## 8. Acessibilidade — o que este protótipo se compromete a fazer

**Não há teste de acessibilidade no projeto e não haverá.** O Radix dá um piso de graça — foco, teclado,
ARIA nos controles. **O que não vem de graça é o que se decide aqui**, e é barato agora e caro depois.
Sete compromissos, e cada um é verificável sem ferramenta nenhuma.

| # | Compromisso | Onde ele é caro se faltar |
|---|---|---|
| **A-1** | **Todo campo tem rótulo associado ao controle** (`FieldLabel` com `htmlFor` ↔ `id`). **`placeholder` nunca é rótulo** | um formulário cujo rótulo desaparece ao começar a digitar é o modo de falha mais comum — e T-04 tem cinco campos |
| **A-2** | **A ordem de foco é a ordem de leitura**, sem índice de tabulação positivo em lugar nenhum. Em T-04 a ordem é exatamente a do orçamento da §2: foto → título → descrição → categoria → área → referência → registrar | é a mesma ordem que o RNF6 otimiza; se divergirem, uma das duas está errada |
| **A-3** | **Nenhum alvo de toque menor que ~44 px** no celular — botões, itens de lista, opções de escolha única e o item do campo de área. **[FONTE EXTERNA]**, alinhado ao critério de tamanho de alvo do WCAG | é a pessoa com **uma mão no corrimão**, que é o cenário literal do RNF6 |
| **A-4** | **O foco visível do Radix não é removido.** É um compromisso de não fazer, e é o mais fácil de quebrar sem perceber | o Gestor em tela grande triando com teclado |
| **A-5** | **Nada é comunicado só por cor.** `prioridade`, `status` e `motivoPausa` **sempre carregam a palavra** — um marcador colorido sem texto é proibido em todo o produto | *"Alta"* e *"Normal"* diferenciados só por cor somem para quem não distingue as duas, e a triagem é justamente comparação |
| **A-6** | **Nenhuma informação vive só em `Tooltip`.** Não há cursor no celular, e T-04 é celular-primeiro | *"área comum × unidade privativa"* é o que decide a visibilidade da ocorrência, e o Solicitante não pode ficar sem ela |
| **A-7** | **A trilha de auditoria é uma tabela de verdade**, com cabeçalho de coluna, não um arranjo visual de blocos | é a tela que se leva à assembleia, e é o entregável mais defensável do projeto — leitor de tela navega tabela célula a célula, e não navega um mosaico |

**O que isto não é:** conformidade declarada. Não há auditoria, não há ferramenta de verificação no
Definition of Done, e **nenhuma destas sete linhas foi testada com uma pessoa que dependa delas**. São
compromissos de construção, não certificado — e a distinção importa porque afirmar acessibilidade sem
teste é o mesmo erro que afirmar usabilidade sem teste.

---

## 9. O artefato clicável — avaliação e recomendação

**A pergunta:** o RNF6 é o único requisito cronometrado do projeto e nada em texto o mede. Uma página só
— a de registro — permitiria cronometrar de verdade, num celular real, com pessoas reais. Vale a pena?

### O que ele mediria, e o que não mediria

| Mede | Não mede |
|---|---|
| **O tempo total do registro com foto**, do toque no ícone ao envio — os passos 2 a 9 do orçamento | **O cold start**, que seria falso num protótipo sem servidor |
| **Quantos caracteres as pessoas de fato escrevem na descrição** — o número que sozinho move o resultado em 49 s, e o mais frágil de todo este documento | **A latência real do `POST /ocorrencias`** |
| **O campo de área nas duas formas** — seletor alfabético contra campo com busca e recentes —, que é um A/B de um campo só e vale 8 s | **Se a pessoa entende o produto**, que é outra pergunta e exigiria roteiro de teste, não cronômetro |
| **A compressão real no aparelho** (RNF8), se usar a câmera de verdade | **Nada sobre as outras nove telas** |

### O custo, em horas

| Etapa | h |
|---|---:|
| Projeto Next.js + Tailwind + `shadcn init` + `add` dos componentes de T-04 — **a stack já é a decidida** | 1 |
| A tela, com dados falsos: 7 categorias e 30 áreas com nomes de condomínio de verdade | 3 |
| Foto real pela câmera do aparelho + compressão para 1600 px / 400 KB | 2 |
| Cronômetro instrumentado: marca cada passo e exporta os tempos | 2 |
| Rodar com 5 pessoas, 2 registros cada, e tabular | 2 |
| **Total** | **10** |

### A recomendação

> **Sim, fazer — com três condições que o tornam barato e o impedem de virar produto.**
>
> **1 · Timebox de 8 horas.** O que não couber não é feito. Dez horas é o orçamento realista; oito é o
> limite que impede o protótipo de ser polido.
>
> **2 · Roda depois da esteira de deploy e antes de T-04 de verdade.** A Documentação da Demanda já põe o
> *pipeline* como primeira tarefa de implementação. Esta é a segunda. **Medir depois de construir T-04
> não mede nada** — mede o que já foi decidido.
>
> **3 · Mede três coisas e só três**, na ordem: (a) o tempo total com foto; (b) quantos caracteres a
> descrição recebe; (c) o campo de área nas duas formas. Qualquer pergunta a mais transforma um cronômetro
> em teste de usabilidade, que é o que o projeto declarou que não vai fazer.

**Os três argumentos a favor, e o terceiro é o que decide:**

1. O RNF6 mitiga o **segundo risco mais alto** da análise de Cagan, e a mitigação é hoje uma folha de
   papel com uma conta que **eu mesmo declarei como suposição**.
2. **A §2.4 diz que ele não fecha** no cenário do próprio contrato. Uma afirmação dessas, feita no papel,
   é opinião; medida, é evidência — **e seria a única evidência de usabilidade que este projeto vai ter.**
3. **Oito horas contra o custo de descobrir tarde.** Se o registro leva 70 segundos e ninguém mede, quem
   descobre é o avaliador da banca ou o primeiro morador — e nesse ponto a tela já está construída, com o
   campo de área do jeito errado e a ordem dos campos do jeito errado.

**O argumento contra, declarado com honestidade:** oito horas de um único implementador em ~6 semanas não
são desprezíveis, e há o risco de o protótipo virar o começo do produto sem passar pelo Definition of
Done. **Mitigação: o protótipo mora fora de `src/`, não entra na esteira, e é apagado depois de medido.**
Se o código for reaproveitado, que seja por decisão explícita — não por inércia.

### Se o hub recusar: como o RNF6 é verificado então, e quando

Três respostas, em ordem de custo — e a primeira é quase de graça:

1. **A verificação de 20 minutos, na primeira vez em que T-04 existir de verdade.** Uma pessoa que **não
   é o implementador** registra uma ocorrência com foto num celular real, cronometrada, e o número é
   anotado. Não é teste de usabilidade e não pretende ser — mas é **a diferença entre um requisito
   medido, ainda que com n=1, e um requisito declarado.** Isso vira **uma linha do Definition of Done**
   (proposta na §13), e é o mínimo que este documento considera aceitável.
2. **Um teste de ponta a ponta no Playwright**, que já está na stack: percorre T-04 e falha se o caminho
   exigir mais interações do que o desenho prevê. **Mede interações, não segundos** — é uma proxy, e
   dizer que é proxy faz parte de usá-la.
3. **Instrumentação em produção** — marcar a abertura de T-04 e o `201` e enviar a diferença. **Não existe
   endpoint para isso, nem analytics no escopo.** É capacidade nova, e portanto é a resposta mais cara,
   não a mais barata.

**Não implementei nada. A decisão é do hub** — ver Q-P1.

---

## 10. O que o desenho descobriu

Dezesseis itens. **Nenhum foi resolvido em silêncio** — ambiguidade se registra (aula 6, p.7–8) —, e seis
deles tocam decisões que são do hub.

| # | O que é | Onde | Gravidade |
|---|---|---|---|
| **P-01** | A ordem dos campos de T-04 e o *"o que aparece sem rolar"* do inventário **não podem valer ao mesmo tempo** | `inventario-de-telas.md`, T-04, *Alvo primário* | **alta** |
| **P-02** | O *"o que aparece sem rolar"* foi raciocinado com o **teclado fechado**; com ele aberto sobra metade da tela | idem, todas as telas de celular | média |
| **P-03** | A exibição de `prioridade` está condicionada ao **recorte** e a justificativa é sobre o **papel** — o Gestor que filtra pelas próprias perde a coluna | `inventario-de-telas.md`, T-03, item 5 | média |
| **P-04** | A lista `todas` **no celular** não tinha decisão de o que cai — e é a tela da Persona 1A | idem, *Alvo primário* de T-03 | média |
| **P-05** | A mitigação possível do **PA-16** é limitada pela **paginação por cursor**, não pela tela | `contrato-de-api.md` §7.7 · `premissas-e-questoes-abertas.md`, PA-16 | média |
| **P-06** | Os tamanhos máximos do schema **não cabem em nenhuma linha de celular**, e três deles em nenhuma linha de tela grande | `api/openapi.yaml` | média |
| **P-07** | Os **cinco campos do F5 não são cinco colunas**: quatro são valores curtos e o quinto é um parágrafo de 1.000 caracteres | `api/openapi.yaml`, `RegistroDeTransicao.observacao` | média |
| **P-08** | `ultimaTransicao` já vem no `OcorrenciaDetalhe` — **o topo de T-05 pinta com uma requisição só** | `contrato-de-api.md` §8.8 | decisão desta tela |
| **P-09** | `acoesDisponiveis` é um array e **o contrato não declara que a ordem significa alguma coisa** — mas a tela precisa de um primário | `contrato-de-api.md` §8.5 · `api/openapi.yaml:2313` | **alta** |
| **P-10** | **Nenhum endpoint devolve o rótulo do outro lado**: a tela do Gestor não pode mostrar exatamente o que o Solicitante lê | `contrato-de-api.md` §8.8 | média |
| **P-11** | `recorrenciaPorArea` tem a **forma de série mensal** e **~30 itens** — não é gráfico, é lista | `api/openapi.yaml`, `Dashboard` | média |
| **P-12** | A regra de cold start *"primeira requisição da sessão"* **não cobre a ociosidade dentro da sessão** | `inventario-de-telas.md` §6, *Cold start* | média |
| **P-13** | A **notificação flutuante quase não tem uso** neste produto, e o único uso que se paga é o desfazer da prioridade | — | decisão deste passo |
| **P-14** | **RNF5 e RNF6 se contradizem**: o cold start acontece **dentro** do minuto cronometrado, e nenhum documento reconciliou os dois | `documentacao-da-demanda.md` §5.2 | **alta** |
| **P-15** | **O RNF6 não é verificável como está escrito** — não declara o cenário, e o cenário move o resultado em 49 s | idem | **alta** |
| **P-16** | `PessoaReferencia.nome` **não tem `maxLength`** no schema, ao contrário dos campos de nome em `POST /vinculos` | `api/openapi.yaml:2318-2326` | baixa |

### P-06 · Os tamanhos máximos do schema contra a largura real da linha

Uma linha de item de lista de celular comporta **cerca de 38 caracteres**. Uma célula de tabela de tela
grande, entre 16 e 34, dependendo da coluna. Contra isso:

| Campo | Máximo no schema | Onde aparece | Cabe? |
|---|---:|---|---|
| `titulo` | **150** | item de lista, celular e tela grande | **não** — cabem ~76 em duas linhas. **Decisão: duas linhas com reticências**, e o título inteiro só em T-05 |
| `categoria.nome` + `area.nome` na mesma linha | **60 + 80 = 143** | item de lista de celular | **não.** **Decisão: quando não couberem juntas, a que corta é a categoria** — as sete sementes são curtas, e uma categoria longa é uma que o próprio Gestor criou; a área é onde alguém tem de ir |
| `Organizacao.nome` | **120** | **cabeçalho, permanentemente visível** (a única consequência de interface da fundação nº 38) | **não.** **Decisão: corta em ~20 caracteres no celular**, com o nome inteiro no menu de troca. E é o mesmo campo que entra na frase de `404` — *"Esta ocorrência não existe em {nome}."* —, o que sustenta a regra da §6.2 de que esse erro é **bloco**, nunca flutuante |
| `PessoaReferencia.nome` | **sem limite declarado** (P-16) | autor, responsável, autor da transição | **não dá para saber.** É o único campo cujo pior caso a tela não consegue calcular |
| `observacao` | **1.000** | trilha e linha do tempo | **não como coluna** — ver P-07 |
| `localizacaoComplemento` | **200** | T-05, ao lado da área | sim, em três linhas |
| `solucaoAplicada` | **4.000** | T-05, bloco próprio | sim, com rolagem do bloco |

**O que isso muda no desenho:** três decisões de corte, todas acima, e uma regra geral — **onde há corte,
há um lugar onde o valor inteiro aparece.** Título cortado na lista, inteiro em T-05. Nome da organização
cortado no cabeçalho, inteiro no menu. Nenhum valor é cortado sem ter para onde ir.

### P-09 · `acoesDisponiveis` chega sem ordem declarada, e a tela precisa de um primário

A barra de ações de T-05 tem **um botão primário largo e um menu "Mais ações"** — porque quatro rótulos
legíveis não cabem em 390 px (D-3). Para escolher o primário, a tela precisa de uma ordem.

`acoesDisponiveis` é `array` de `Comando`, e **nem o contrato §8.5 nem o `openapi.yaml` dizem que a ordem
do array significa alguma coisa.** Sem isso, as duas saídas são ruins: fixar a ordem em código no cliente
é uma migalha da máquina de estados fora do domínio — o que o campo existe para impedir —, ou renderizar
na ordem em que vier, que pode mudar entre respostas.

**A saída barata já está no YAML.** O schema `Comando` (`api/openapi.yaml:2313`) traz os dez valores nesta
ordem: `analisar · alterar-prioridade · atribuir-responsavel · iniciar-atendimento · pausar · retomar ·
registrar-solucao-aplicada · resolver · cancelar · avaliar`. **É a ordem do ciclo de vida**, e é
exatamente a ordem de prioridade que a barra quer.

**Recomendação:** o contrato declara que **`acoesDisponiveis` chega na ordem do enum `Comando`**, e que **o
primeiro elemento renderizável como botão é o primário**. Custo: uma frase no contrato e uma linha no
`openapi.yaml`. Ver **Q-P3**.

### P-14 e P-15 · O RNF6 contra o RNF5, e o RNF6 contra si mesmo

Os dois requisitos estão na mesma tabela da Documentação da Demanda, uma linha abaixo da outra, e **não
foram lidos juntos**:

- **RNF5:** *"cold start na primeira requisição após ociosidade é **esperado e declarado**"*.
- **RNF6:** *"**da abertura do app** ao envio da ocorrência, incluindo foto"* — menos de 60 s.

**A primeira requisição do dia acontece dentro do minuto do RNF6.** Ou o RNF6 é impossível de cumprir na
primeira abertura de cada dia, ou ele mede outra coisa que não está escrita.

E o RNF6 tem um segundo problema, independente do primeiro: **ele não declara o cenário.** A diferença
entre uma descrição de 17 caracteres e uma de 140 é de **49 segundos** — mais de 80% do orçamento inteiro
(§2.2). Um requisito cronometrado sem cenário declarado não é verificável: qualquer resultado pode ser
defendido escolhendo o texto certo.

**Recomendação, e é uma só para os dois** (ver **Q-P2** e a §13): o RNF6 ganha, na própria linha da tabela,
**o cenário de medição** e a **exclusão explícita do cold start** — algo como *"medido em requisição morna,
com título de até 30 caracteres, descrição de até 40, uma foto, e categoria e área escolhidas de listas já
carregadas"*. Com esse cenário e o desenho da §2, **o orçamento fecha em 53 s, com 7 s de folga** — e passa
a ser uma afirmação que alguém pode conferir com um cronômetro.

**A alternativa que eu não recomendo:** tornar a `descricao` opcional. Ela fecharia o orçamento com folga,
mas o enunciado exige *"registrar com título, descrição e categoria"* (`ENUNCIADO · literal`, S3 e S4), e
uma ocorrência sem descrição é a mensagem solta de WhatsApp que o produto veio substituir. **É o requisito
que precisa de cenário, não o campo que precisa de corte.**

---

## 11. Suposições declaradas

**Não haverá teste de usabilidade neste projeto** — limitação 4 da Documentação da Demanda, com o risco de
usabilidade classificado como **alto**. **Toda decisão de interação deste documento é suposição.** As oito
abaixo são as que mudam o desenho se estiverem erradas.

| # | Suposição | O que muda se estiver errada |
|---|---|---|
| **S-P1** | **Digitação com um polegar a ~2,5 caracteres por segundo**, incluindo correção | **É a suposição mais cara do documento.** A 1,5 c/s o orçamento não fecha em cenário nenhum e o desenho de T-04 precisa de outra ideia; a 4 c/s ele fecha até com a descrição do contrato, e a §3 vira otimização, não necessidade |
| **S-P2** | **A foto como primeiro alvo não afasta quem não vai anexar foto** | Se afastar, a taxa de registro cai por causa de um passo opcional — e o conserto é inverter foto e título, perdendo o paralelismo do DG-5 em rede ruim |
| **S-P3** | **Duas trocas de teclado custam ~0,75 s cada**, e por isso digitar tudo antes de escolher tudo é melhor | Se o custo for desprezível, a ordem do inventário volta a ser defensável e o **P-01** deixa de ser achado |
| **S-P4** | **Gaveta inferior no celular alcança melhor o polegar que caixa centrada** | Se não alcançar, `pausar` e `cancelar` ficam mais lentos exatamente no cenário que os justifica — o Gestor de pé, com uma mão |
| **S-P5** | **A pré-visualização do texto impede o aviso de visibilidade de virar paisagem** | Se não impedir, o erro que o aviso existe para prevenir — nota interna escrita na observação — acontece, e é **irreversível** |
| **S-P6** | **"Usadas recentemente" cobre a maioria dos registros de uma pessoa**, porque um morador reclama quase sempre dos mesmos lugares | Se as áreas forem dispersas, o bloco de recentes não ajuda e sobra a busca sozinha — 6 s em vez de 4, e a saída (d) da §3 fica mais forte |
| **S-P7** | **Guardar `areaId` recentes no aparelho é aceitável**, e não conflita com a S-T6 do inventário | Se o hub considerar estado de cliente demais, a §3 perde a saída (c) |
| **S-P8** | **O `Badge` com a palavra dentro basta para diferenciar prioridade e status sem depender de cor** | Se não bastar, a densidade da lista `todas` no celular cai, e um item de três linhas vira quatro |

---

## 12. Questões ao hub

| # | Questão | Opções | Recomendação |
|---|---|---|---|
| **Q-P1** | **O artefato clicável de T-04 vale 8 horas?** (§9) | (a) sim, com timebox de 8 h, depois da esteira e antes de T-04 real, medindo três coisas; (b) não, e o RNF6 é verificado pela cronometragem de 20 minutos na primeira T-04 real, virando linha do DoD | **(a).** É a única evidência de usabilidade que o projeto vai ter, e a §2.4 afirma que o RNF6 **não fecha** no cenário do próprio contrato. Se for (b), a linha no DoD **não é opcional** |
| **Q-P2** | **O RNF6 ganha cenário de medição e exclusão explícita do cold start?** (P-14, P-15) | (a) sim — cenário na própria linha do RNF6, cold start fora do relógio; (b) não, fica como está; (c) o RNF6 é relaxado para 90 s | **(a).** (b) mantém um requisito não verificável, e (c) troca um número que dá para cumprir por um que ninguém pediu |
| **Q-P3** | **`acoesDisponiveis` chega numa ordem declarada?** (P-09) | (a) sim — a ordem do enum `Comando`, que é a do ciclo de vida, e o primeiro renderizável é o primário; (b) não, e a tela fixa a ordem em código | **(a).** (b) põe no cliente uma migalha da máquina de estados, que é o que o campo existe para impedir |
| **Q-P4** | **A regra de cold start é por ordem ou por tempo?** (P-12) | (a) por tempo — qualquer requisição acima de ~2 s ganha o texto; (b) por ordem, como o inventário escreveu, mantendo a exceção de T-07 | **(a).** É mais simples, cobre a ociosidade dentro da sessão e elimina a exceção |
| **Q-P5** | **`Area` ganha `ordem`?** (§3 e o F12 do inventário) | (a) sim — simétrico a `Categoria`, com `PATCH /areas` aceitando o campo; (b) não, e fica a busca com recentes | **(a)**, agora com evidência de tempo: é o único conserto que serve **no primeiro registro**, que é o que decide se existe um segundo |
| **Q-P6** | **O `Chart` (Recharts) entra como dependência para um gráfico?** (§7.3) | (a) sim — um gráfico, no indicador que justifica o dashboard existir; (b) não, e a recorrência por categoria vira lista com barras, como a por área já é | **(b)**, se o hub quiser proteger a frase da arquitetura de que *"shadcn/ui não é dependência"*; **(a)** se a recorrência precisar ser lida de relance. **A decisão é do hub porque é dependência, não desenho** |
| **Q-P7** | **A prioridade aparece por permissão em vez de por recorte?** (P-03) | (a) sim — `ocorrencia.alterar_prioridade`; (b) não, fica por `visibilidadeAplicada` | **(a).** É a própria doutrina do inventário: ações governadas por permissão, nunca por verificação de papel |
| **Q-P8** | **O convite a avaliar pode ter dois textos — a frase inteira em T-05 e "Conte como foi" na lista?** (D-2) | (a) sim; (b) não, a frase inteira nos dois lugares | **(a).** Na lista, a frase inteira duplica o `statusRotulo` que o servidor mandou, e a segunda cópia seria montada no cliente |

---

## 13. Propostas de mudança em outros documentos

**Nenhuma foi aplicada — exceto a nº 4, aplicada em 30/08/2026.** Cada uma cita o arquivo, o que muda e
por quê. *(A frase dizia "nenhuma foi aplicada", sem exceção, até 30/08/2026 — item 23 da fila da frente
de documentação.)*

| # | Arquivo | Mudança proposta | Origem |
|---|---|---|---|
| 1 | `documentacao-da-demanda.md` §5.2, linha do **RNF6** | Acrescentar o **cenário de medição** e a **exclusão do cold start**: *"medido em requisição morna, com título de até 30 caracteres, descrição de até 40, uma foto, e categoria e área escolhidas de listas já carregadas. O cold start do RNF5 fica fora do relógio."* | **P-14, P-15** · Q-P2 |
| 2 | `documentacao-da-demanda.md` §5.2, linha do **RNF5** | Uma frase reconhecendo a colisão: *"o cold start acontece dentro da janela do RNF6, e por isso está excluído da medição dele."* Hoje os dois requisitos se contradizem em silêncio | **P-14** |
| 3 | `contrato-de-api.md` §8.5 e `api/openapi.yaml` (`acoesDisponiveis`) | Declarar que **a ordem do array é a do enum `Comando`**, e que o primeiro elemento renderizável é o primário da tela | **P-09** · Q-P3 |
| 4 | `inventario-de-telas.md`, T-03, item 5 da lista de campos | Trocar a condição de exibição de `prioridade`: de `visibilidadeAplicada == "todas"` para `contexto.permissoes` incluir `ocorrencia.alterar_prioridade` | **P-03** · Q-P7 · ✅ **aplicada em 30/08/2026** — decidida na P2 da spec do item 28, virou o critério **28.6**, e o inventário registrou a troca com data |
| 5 | `inventario-de-telas.md`, T-04, *Alvo primário* | Trocar *"sem rolar: `titulo`, `categoria` e o botão de foto"* por *"sem rolar: a foto, `titulo` e `descricao`; `categoria` e o bloco **Onde** vêm abaixo"*, com a razão de tempo | **P-01** |
| 6 | `inventario-de-telas.md` §6, *Cold start* | Trocar a regra de **ordem** (*"primeira requisição da sessão"*) pela regra de **tempo** (*"qualquer requisição acima de ~2 s"*), e remover a exceção de T-07, que deixa de ser exceção | **P-12** · Q-P4 |
| 7 | `inventario-de-telas.md`, T-03, quadro do convite a avaliar | Registrar os **dois textos**: a frase inteira em T-05, e o botão *"Conte como foi"* no item da lista, ao lado do `statusRotulo` | **Q-P8** |
| 8 | `inventario-de-telas.md`, T-05, ordem dos quatro blocos | Registrar que o **bloco 1 é partido** e que a `ultimaTransicao` sobe para o topo, com a razão: o topo pinta com uma requisição só | **P-08** |
| 9 | `api/openapi.yaml`, schema `Area` | Acrescentar `ordem`, simétrico a `Categoria`, e aceitá-lo em `PATCH /areas` | **§3** · Q-P5 · reforça o **F12** do inventário |
| 10 | `api/openapi.yaml`, schema `PessoaReferencia` | Declarar `maxLength` em `nome` — hoje é `string` sem limite, e a tela não consegue calcular o pior caso de nenhuma linha em que um nome apareça | **P-16** |
| 11 | `arquitetura.md` §2, linha do **shadcn/ui** | Atualizar a justificativa: o `Form` deixou de ser componente do catálogo (hoje são guias de integração + o `Field`); e declarar que **"sobre Radix" é escolha explícita por componente**, porque o catálogo passou a oferecer mais de uma base | **§7.3** |
| 12 | `arquitetura.md` §2, linha do **shadcn/ui** | Registrar a **exceção do `Chart`**: ele é o único componente do catálogo que traz dependência de terceiro (Recharts) para o `package.json`, contra a afirmação de que *"o CLI copia o código para o repositório"* | **§7.3** · Q-P6 |
| 13 | `definition-of-done.md`, seção **Testes** | Uma linha: *"o caminho de registro foi percorrido num celular real, por alguém que não é o implementador, e o tempo foi anotado."* É a verificação mínima do RNF6, e custa 20 minutos | **§9** · Q-P1 |
| 14 | `definition-of-done.md`, seção **Qualidade do código** | Uma linha para os sete compromissos de acessibilidade da §8, com foco em A-1 (rótulo associado), A-3 (alvo de toque) e A-5 (nada só por cor) — os três verificáveis a olho | **§8** |
| 15 | `premissas-e-questoes-abertas.md`, **PA-16** | Acrescentar que a mitigação possível na primeira entrega é **limitada pela paginação por cursor**: a contagem de *"resolvidas para avaliar"* é da página carregada, não do total, porque `GET /ocorrencias` não devolve `total` | **P-05** |
| 16 | `premissas-e-questoes-abertas.md`, §3 | **PA novo:** *"A tela do Gestor não pode mostrar o rótulo que o Solicitante lê — `statusRotulo` é calculado no servidor em função de quem lê, e nenhum endpoint devolve o rótulo do outro lado."* | **P-10** |
| 17 | **`docs/README.md`**, linha 28 | *"As **dez** telas da primeira entrega"* → *"As **treze**"*. O inventário passou a treze em 21/08/2026. **Não é o `README.md` da raiz** | **§15**, revisão de T-01 |
| 18 | `contrato-de-api.md` §9.5 | Qualificar *"Criar conta, entrar, sair, redefinir senha: Supabase Auth"*. A frase é verdadeira sobre **endpoints** e foi lida como verdadeira sobre **telas** — e foi essa leitura que deixou três formulários sem especificação por dois passos. Proposta: *"…são do provedor. **As telas que os consomem são nossas** — o SDK não traz interface."* | **§15**, revisão de T-01 |
| 19 | `contrato-de-api.md` §8.2 · `escopo.md` atividade 1 | **Só se o hub aprovar a Q-T6 como (b):** `PATCH /contexto/pessoa` no contrato, e a capacidade *"Editar os próprios dados pessoais"* no escopo. **Não proponho o texto** — é capacidade nova, e capacidade nova não nasce numa revisão de tela | **F11**, recomendação trocada |
| 20 | `arquitetura.md` §2, tabela de tecnologias | **Dependência de terceiro nº 2, e esta não tem saída barata:** normalizar telefone para **E.164** exige biblioteca (`libphonenumber` ou equivalente), porque país padrão, regra de discagem nacional e validade de número não caem em expressão regular — o próprio `modelo-de-dados.md` §6.17 diz isso e nomeia a referência. Diferente do gráfico, que era conveniência e saiu: **sem isto, o `CHECK` do banco recusa o que o formulário produzir** | **§7.2, item 6** |

---

## 14. Limitações — o que não foi verificado

**1 · Nenhum desenho foi visto por um usuário, e o orçamento da §2 não foi cronometrado.** Os números da
§2.2 saem das premissas da §2.1, e a premissa 2 — a velocidade de digitação — **é uma estimativa externa,
não uma medição**. É exatamente por isso que a §9 recomenda o artefato clicável: **este documento afirma
que o RNF6 não fecha, e essa afirmação precisa de um cronômetro para virar evidência.**

**2 · As treze telas foram renderizadas num navegador; nenhuma foi vista por um usuário.** A limitação
que vivia aqui — *"os desenhos não foram renderizados, e o alinhamento deles vale como esquema de regiões,
não como medida de pixels"* — **foi cumprida em 21/08/2026**, e a primeira coisa que a renderização fez foi
derrubar afirmações deste documento. Estão na §16.

**O que sobra da limitação, e é a metade maior:** renderizar prova que **cabe**; não prova que **funciona**.
Nenhuma das 73 telas foi posta na frente de um Solicitante ou de um Gestor, não há teste de usabilidade no
projeto, e o risco de usabilidade continua classificado como **alto**. As oito suposições da §11 seguem
sendo suposições.

**3 · O catálogo do `shadcn/ui` foi conferido na documentação oficial em 20/08/2026, mas nenhum componente
foi instalado.** *"Existe na documentação"* e *"funciona como eu suponho neste contexto"* não são a mesma
verificação. Os quatro pontos marcados ⚠️ na §7 são o que eu **não** consegui confirmar; os demais foram
lidos na página do próprio componente. O catálogo se mexeu desde a decisão da `arquitetura.md` — ver §7.3
—, e vai continuar se mexendo.

**4 · Nenhum texto de interface deste documento foi revisado por outra pessoa.** Ele usa o vocabulário do
glossário e os rótulos literais, mas *"usa o vocabulário certo"* e *"é a frase certa"* continuam sendo
duas verificações diferentes — a mesma limitação que o inventário já declarou, herdada intacta.

**5 · A acessibilidade da §8 é compromisso, não conformidade.** Não há auditoria, não há ferramenta no
Definition of Done, e nenhuma das sete linhas foi testada com quem depende delas.

---

## 15. Decisões da revisão

**O que mudou desde que estes documentos foram fechados, e por quê.** Cada linha existe para que o
`git diff` seja legível: o diff diz *o que* mudou, esta seção diz *por que*. **A voz do que foi
observado é de quem revisou**, não minha.

---

### 22/08 · A rodada da modelagem — contatos, unidade e anexo

**O que foi observado.** *"A modelagem de dados foi revisada e agora as telas mudam. Na rodada do anexo não
mudavam; nesta, sim."* — atualização escopada: o que os campos e os endpoints se chamam, mais três lugares
que ganham controle novo. **Nada da estrutura foi posto em questão.**

**O que mudou, tela por tela.**

| Tela | O quê |
|---|---|
| **T-02** face A | **Dois campos novos**, os dois opcionais: `nome` **pré-preenchido**, que é a última chance de corrigir um dado que vai para a trilha imutável; e `telefone` **em E.164**, com máscara e país padrão BR |
| **T-03** | A marca *"com foto"* deixou de ser booleana: é **`quantidadeDeAnexos > 0`**. **Sem miniatura na listagem** — o porquê está abaixo |
| **T-04** | `POST /anexos/autorizacoes`, **duas** `PUT` numa autorização só (original + miniatura), `ANEXO_*` no lugar de `IMAGEM_*`, e o erro novo **`ANEXO_JA_REIVINDICADO`**. **Nenhum campo mudou de lugar** |
| **T-05** | `anexos[]` no lugar de `imagemUrl`; `GET /ocorrencias/{id}/anexos/{anexoId}`; e a **miniatura como o que pinta primeiro** no lugar do retângulo cinza |
| **T-08** | **A tela que mais mudou.** Contato virou lista, e o cadastro ganhou um **sub-formulário repetível**; coluna de **unidade**; `409 CONTATO_DUPLICADO`; e `observacao` na recusa de pedido |
| **T-11** | Nada de campo. A razão de **não** pedir contato ficou mais forte, e está reescrita |
| T-01 · T-06 · T-07 · T-09 · T-10 · T-12 · T-13 | **nada.** E isso é informativo: a modelagem não tocou trilha, indicador, configuração nem credencial |

**O que NÃO mudou, e vale dizer.** As treze telas, a decisão de uma área com telas compartilhadas, a ordem
dos campos de T-04, os três vazios de T-03, os estados de espera e erro, a barra de ações de T-05, a
restrição do PA-25 em T-08 e os sete compromissos de acessibilidade: **tudo de pé, e nada disso foi
reaberto.**

**O que custou no orçamento do RNF6: zero segundo.** A conta está na §2.6.

**As quatro decisões que sobraram para mim** estão na §2.6 e na §16.4.

**O que ficou pendente, e é do hub:** o achado **F13** do inventário — `vinculos.area_id` não tem escritor
para quem tem conta —, a **Q-T10** que ele abre, e a dependência de normalização de telefone (proposta 20 da
§13).
---

### 21/08 · As treze telas renderizadas — o HTML substitui o ASCII

**O que foi observado.** *"Pode fazer de todas as outras telas que restam! Faça todas sem parar [...] o
importante é fazer todas nessa execução!"* — com a ressalva de que mudanças em curso no modelo de dados
seriam trazidas depois.

**O que mudou.**

| Onde | O quê |
|---|---|
| **`docs/prototipo/telas.html`** | Passou de 3 para **13 telas**, em **73 estados**. Ordem de leitura, não de identificador: credencial → sem organização → lista → registro → detalhe → trilha → dashboard → pessoas → configuração → sem permissão |
| idem, folha de estilo | Vocabulário compartilhado estendido: moldura de tela grande, rótulo, filtros, lista, tabela com linha de continuação, gaveta, caixa centrada, escolha única, indicadores e esqueleto. **Escrito uma vez** — é o que impede as telas de divergirem entre si |
| `prototipo-low-fi.md` §1.2 | A divisão *desenhada × descrita* deixou de existir. O critério passa a decidir **quantos estados**, não *se* desenha |
| idem, §1.3 | A tabela de convenções do ASCII saiu — descrevia uma notação que o documento não usa mais |
| idem, **D-2 a D-6** | **As dez molduras restantes saíram**, substituídas por link para o estado correspondente. A prosa ficou inteira: as decisões de forma, as razões, e os achados P-01 a P-16 |

**O que custou.** **Nada no orçamento do RNF6** — a §2 não foi tocada, porque nenhuma decisão de ordem de
campo mudou. O custo real é outro e é permanente: **treze telas agora têm obrigação de manutenção**, e o
HTML é o entregável mais fácil de esquecer, porque ninguém o relê.

**O que a renderização descobriu**, e é o motivo de ela existir — está tudo na §16.
---

### 21/08 · Mudança de escopo — o HTML passa a ser entregável

**O que foi observado.** Decisão do hub: *"o HTML que você gera para revisão deixa de ser instrumento
descartável e passa a ser entregável, dentro de `docs/`. Ele é material de implementação: mostra o
conteúdo no pior caso, o tamanho real dos alvos de toque e o comportamento em largura de celular — coisas
que a moldura de texto monoespaçado não consegue mostrar, porque ela convence escolhendo o texto que
cabe."*

**O que mudou.**

| Onde | O quê |
|---|---|
| **`docs/prototipo/telas.html`** | Arquivo novo. Autocontido — sem CDN, sem build, sem rede —, abre do sistema de arquivos com dois cliques. Contém **T-04 inteira, em nove estados**, e as cinco pendentes marcadas como pendentes |
| `prototipo-low-fi.md` §1.1 | O meio deixa de ser *"blocos de texto monoespaçado dentro deste arquivo"*. Regra registrada: **um desenho, um lugar** |
| idem, **D-1** | **As três molduras de T-04 saíram**, substituídas por link. **A prosa ficou inteira** — as cinco decisões de forma, o P-01 e o P-02 |
| idem, §14, limitação 2 | Passa a valer só para D-2 a D-6 |

**Por que um arquivo e não seis.** As seis telas compartilham vocabulário visual pesado: a barra do shell
com o nome da organização, o rótulo de status, o item de lista, a barra de ações, a gaveta, a tabela.
Escrito uma vez, elas **não podem** divergir entre si; em seis arquivos, o dia em que o rótulo mudar são
seis lugares para lembrar — que é o mesmo apodrecimento calado que a obrigação de manutenção existe para
impedir. O índice fixo no topo resolve achar a tela sem instrução.

**O que a renderização já custou, e é o item mais caro desta entrada.**

> **A afirmação *"o formulário inteiro cabe sem rolar"* não sobreviveu ao primeiro navegador.** Com os
> tamanhos reais — alvo de toque de 48 px, descrição de duas linhas, o bloco *Onde* com dois campos —, o
> conteúdo de T-04 passa dos 844 px do aparelho, e passa **muito** dos ~745 px que sobram dentro do
> navegador depois da barra do sistema.
>
> A página **mede isso no aparelho de quem abre e imprime o número na legenda**, em vez de afirmar — era
> exatamente o que a limitação 2 dizia que o primeiro navegador faria com essa frase.
>
> **Isto não muda o orçamento do RNF6 da §2**, e vale dizer por quê: rolar não é um passo cronometrado
> ali, e a ordem dos campos — que é o que os 9,5 segundos economizados compraram — **não mudou**. O que
> muda é a afirmação sobre a dobra, que era do inventário e do D-1, não da conta.

**O que ficou pendente.**

- **Corrigir o texto de D-1 e o *Alvo primário* de T-04 no inventário**, que ainda afirmam o que a
  renderização desmente. Não alterei: a frase é do inventário, o número aparece no aparelho de quem
  revisa, e a correção espera a leitura dele.
- **Renderizar D-2 a D-6.** Cinco telas, na ordem de revisão. Enquanto não existirem, **as molduras de
  texto delas ficam onde estão** — documento sem desenho nenhum seria pior que documento com desenho
  velho.
- **A lista de Áreas está na ordem do Gestor**, e não alfabética, porque `Area` ganhou `ordem` no
  contrato em 21/08. **A §3 deste documento ainda trata isso como proposta**, e a §2.4 ainda precifica o
  campo pela busca com recentes. Fica declarado até o hub decidir se a conta é recalculada.
- **As sete categorias-semente são citadas em quatro documentos e não estão enumeradas em nenhum** — nem
  no enunciado, nem no `openapi.yaml`, nem na POL-01. Os dados do HTML são de exemplo e estão marcados
  como tal, mas **quem implementar vai precisar saber quais sete**.

---

### 21/08 · T-01 — *"faz sentido T-01 ser duas telas?"*

**O que foi observado.** *"Faz sentido T-01 ser duas telas? Não seria melhor ter uma tela só para entrar
e outra tela para cadastro com ligação entre as duas?"* E, sobre o cadastro: *"só cadastra usuário, ou
vai ter os dados de pessoa também? Faria sentido pensar nessa tela como tela de edição também? [...] no
MVP está previsto que gestor pode editar pessoas e usuários?"*

**O que a revisão encontrou, e é maior que a pergunta.** T-01 declarava **três ações** —
*"Entrar · criar conta · redefinir senha"* — e especificava **um** formulário. Cadastro e redefinição
nunca tiveram campos escritos, e **o link do e-mail de redefinição não tinha onde aterrissar**. O erro
foi de leitura: *"nenhuma das três chama endpoint deste contrato"* é verdade sobre **endpoints** e foi
lida como verdade sobre **telas**. O Supabase Auth entra por **SDK**, não por interface hospedada — os
formulários sempre foram nossos.

**O que mudou.**

| Onde | O quê |
|---|---|
| `inventario-de-telas.md` | **Dez telas → treze.** T-01 vira *Entrar*; nascem **T-11 · Criar conta**, **T-12 · Redefinir senha** e **T-13 · Definir nova senha**. Identificadores **no fim da lista**, não renumerados: `escopo.md` cita T-10 pelo nome |
| idem, §1 | **Critério novo, escrito porque foi ele que decidiu:** *"uma tela tem conjunto de campos próprio e fim próprio — e estar nela exclui estar na outra. Sem campo próprio, é estado."* |
| idem, §3 | Mapa de navegação e tabela do botão *voltar* com as três novas. **T-13 nunca volta ao formulário** — o endereço carrega token |
| idem, §4 | Seção nova das quatro, com o que elas têm em comum escrito **uma vez** em vez de quatro |
| idem, §5 | Linha *"Perfil / minha conta"* revista: metade tem dono, metade não |
| `prototipo-low-fi.md` §1.2, §5 | **Seis desenhadas, sete descritas.** Nenhuma das quatro é desenhada, pela mesma razão que a original não era |

**O que custou, e o que fechou.**

- **Nada no orçamento do RNF6.** O cenário do RNF6 começa *"no toque no atalho do aplicativo já
  instalado, com sessão válida e organização ativa"* (`documentacao-da-demanda.md` §5.2) — as quatro
  telas da credencial estão **fora do relógio**, por definição do próprio requisito. A §2 não muda.
- **Fechou o F6** — *"o nome de uma Pessoa recém-criada não tem origem declarada"*. **T-11 pede o
  `nome`, obrigatório**, e o grava no metadado do provedor no `signUp`; o ACL semeia `pessoas.nome` de um
  campo que **nós** escrevemos. Custo: **zero** mudança de contrato — não é a opção (b) da Q-T5, que
  mexia em schema. A **S-T12 deixou de ser suposição** e a **Q-T5 está respondida por construção**.
- **O cadastro não pede contato nenhum**, e em 22/08 a razão ficou mais forte: contato virou **lista** com tipo, finalidade, ordem e WhatsApp, e pôr um sub-formulário repetível entre alguém e a própria conta seria o oposto do que a primeira tela do produto precisa. O e-mail do cadastro não é a
  credencial, mas no cadastro só existe a credencial — pedir as duas cobra de todo mundo uma distinção
  que quase ninguém tem; e `telefone` já tem casa no pedido de entrada, que é onde a necessidade nasce.

**O que ficou pendente, e é do hub.**

- **Q-T6, com a recomendação trocada.** A tela de perfil que foi perguntada **não é T-11** — T-11 é sem
  sessão e a edição exige uma. E a divisão proposta na revisão (*dados pessoais* × *dados de acesso*) é
  exatamente a linha entre o que a nossa API faz e o que ela não faz: acesso é SDK, **zero endpoint**;
  dados pessoais **não têm endpoint nenhum**. Este documento recomendava (a) — *"edita no provedor"* — e
  **a recomendação estava errada pelo mesmo motivo do F6**: não existe página do provedor. Passa a
  recomendar **(b)**, `PATCH /contexto/pessoa`. **É capacidade nova; é do hub.**
- **Q-T9, nova:** a confirmação de e-mail é obrigatória antes do primeiro login? É interruptor do
  provedor e decide como T-11 termina. **Recomendo obrigatória** — o e-mail é o único canal de
  recuperação, e um endereço errado nunca confirmado deixa a conta irrecuperável sem ninguém descobrir.
- **Propostas 17, 18 e 19 da §13** — `README.md`, a frase do contrato §9.5 que produziu a leitura errada,
  e o par contrato/escopo que só existe se a Q-T6 for (b).

**O que foi confirmado sem mudar nada.** *"Gestor pode editar pessoas e usuários?"* — **usuário: nunca**
(o Gestor não toca credencial em lugar nenhum); **pessoa: só quem não tem conta**
(`409 PESSOA_COM_CONTA_NAO_EDITAVEL`); **papel: nunca** (`PATCH /vinculos/{pessoaId}` não aceita `papel`,
Q-API-6). O *"não deve explodir"* da tela do Gestor **já está garantido por construção**: T-08 mostra
`pessoa` + `temConta` + `papel` — exatamente os três nomeados na revisão — e não tem como crescer para
editor de perfil, porque os endpoints que faltam não existem.

**6 · Os três desenhos de tela grande assumem ~1280 px e os de celular ~390 px.** Larguras entre os dois
extremos — um tablet, uma janela estreita num monitor grande — **não foram desenhadas**, e o que acontece
nelas é decisão de implementação. A regra que fica: **a densidade do item vem do recorte; o número de
colunas vem da largura** (D-2), e ela se aplica a qualquer largura intermediária sem precisar de desenho
novo.

---

## 16. O que a renderização descobriu

**Trinta e dois itens, e nenhum foi resolvido em silêncio.** Dez nasceram na rodada de 22/08 — cinco meus, cinco achados ao renderizar T-08 — e um, o R-01, foi fechado por ela — ambiguidade se registra (aula 6, p.7–8).

A série **P** da §10 veio de desenhar em texto monoespaçado. A série **R** abaixo vem de **renderizar num
navegador**, com os tamanhos reais e o conteúdo no limite do schema. A distinção importa: são dois
instrumentos diferentes, e o segundo enxerga o que o primeiro escondia por construção.

**Sete deles não são achados novos: são divergências que já existiam e que a renderização obrigou a
encarar**, porque não dá para desenhar um campo sem decidir qual é o nome dele.

### 16.1 · Divergências entre documentos — fatos verificáveis, não interpretação

| # | O que é | Onde | Quem conserta |
|---|---|---|---|
| ~~**R-01**~~ | ~~`temImagem` → `quantidadeDeAnexos`~~ | — | ✅ **corrigido em 22/08** |
| **R-02** | `Area` **ganhou `ordem`** no contrato, mas a §3 deste documento ainda trata isso como proposta e a §2.4 ainda precifica o campo pela busca com recentes | `prototipo-low-fi.md` §3 e §2.4 · `api/openapi.yaml`, `Area` | **meu**, e mexe no orçamento |
| **R-03** | `PessoaReferencia.nome` **ganhou `maxLength: 120`**; o achado P-16 afirma que ele não tem limite | `prototipo-low-fi.md` §10, P-16 | **meu** |
| **R-04** | O componente de gráfico **saiu da primeira entrega**; a §7.1 ainda o lista ✅ e a Q-P6 ainda está aberta | `prototipo-low-fi.md` §7.1 e §12 · `arquitetura.md` §2 | **meu** |
| **R-05** | O glossário **aposentou o termo *fatia 2*** em favor de *evolução prevista*; ele aparece **5 vezes** no inventário | `inventario-de-telas.md` · `glossario.md` §6 e §8 | **meu** |
| **R-06** | O glossário corrigiu a lista de comandos que transicionam: são **seis**, e `avaliar`, `atribuirResponsavel` e `registrarSolucaoAplicada` **não** estão entre eles | `glossario.md` §4 | já corrigido lá |
| **R-07** | A ordem de `acoesDisponiveis` **foi declarada** — e numa ordem **diferente** da que o P-09 propôs | `api/openapi.yaml`, `Comando` | já corrigido lá |

### 16.2 · O buraco que a declaração do contrato abriu — R-08

> **Ninguém escolhe a ação primária de T-05, e os dois documentos apontam um para o outro.**

O contrato declarou a ordem de `acoesDisponiveis`, como o **P-09** pedia. Mas declarou **negando** a
segunda metade do pedido, e com razão. A frase — **e ela mora na descrição do enum `Comando` do
[`api/openapi.yaml`](api/openapi.yaml)**, não na prosa do `contrato-de-api.md`:

> *"Não é promessa de que o primeiro item seja a ação em destaque — em `em_atendimento`, por exemplo,
> `pausar` precede `resolver`. Escolher o destaque é decisão de tela, **e a regra está no inventário de
> telas**."*

*(**Correção — 30/08/2026.** Até esta data o achado atribuía a frase inteira ao `contrato-de-api.md`
§8.5, entre as aspas de uma citação única. **A frase existe, literal — mas no `openapi.yaml`.** A prosa
do contrato termina em "Qual ação ganha ênfase é decisão de tela." e **não continua**: os dois entregáveis
divergem entre si, e é a especificação publicada que carrega o ponteiro. Ou seja: **o ponteiro é real**, e
a moldura do achado — *"os dois documentos apontam um para o outro"* — está certa; o que estava errado era
**qual** dos dois arquivos apontava. Item 17 da fila da frente de documentação.)*

**O inventário não tinha essa regra.** A barra de ações de T-05 tem um primário largo e um menu *Mais
ações* — e nada, em documento nenhum, dizia qual comando ia no primário. Ao renderizar, foi preciso
escolher à mão: em `em_atendimento`, o primeiro renderizável pela ordem do enum seria **Reatribuir**, que
é obviamente errado.

**Era achado de gravidade alta, e o único desta lista que impedia alguém de implementar a tela.**

> #### O R-08, fechado — 30/08/2026
>
> **Como bloqueio ele já estava fechado desde o item 22**, que pôs a tabela de ação primária em código
> junto com o desempate. O que continuava faltando era **o documento para onde o `openapi.yaml` aponta**.
>
> **O inventário passou a ter a regra**, em quadro próprio na seção de T-05 — *"As três regras que a
> tabela não carregava"*:
>
> > `aberta` → **Analisar** · `em_analise` → **Iniciar atendimento** · `em_atendimento` →
> > **Resolver** · `pausada` → **Retomar** · `resolvida` → **Avaliar** · `cancelada` → nenhuma. **Se a
> > ação nomeada não estiver entre as disponíveis, o destaque vai para a primeira da lista**; se não houver
> > nenhuma, não há destaque.
>
> **A conclusão do achado estava certa e não foi apagada:** a regra faltava mesmo, e a lacuna era real. O
> que mudou foi a **atribuição** — em vez de *"o contrato mandou para o inventário e ele não cumpriu"*, o
> correto é *"o ponteiro está no `openapi.yaml`, a prosa do contrato não o repete, e nenhum dos dois
> documentos escolhia"*.
>
> **E o ponteiro passou a ser verdadeiro:** o `openapi.yaml` diz que *"a regra está no inventário de
> telas"* — e a partir desta data ela está. **O que fica em aberto, e não é desta frente:** a prosa do
> `contrato-de-api.md` §8.5 continua sem o ponteiro que a especificação publica.
> *(Item 17 da fila da frente de documentação, as duas metades.)*

### 16.3 · Achados novos, da renderização

| # | O que é | Gravidade |
|---|---|---|
| **R-09** | **A afirmação *"o formulário de T-04 cabe sem rolar"* é falsa nos tamanhos reais.** Com alvo de toque de 48 px, o conteúdo passa dos 844 px do aparelho e passa muito dos ~745 que sobram dentro do navegador. A página mede e imprime o número | **alta** |
| **R-10** | **`visibilidadeAplicada` chega na resposta**, então durante a primeira carga T-03 não sabe qual das duas caras desenhar — nem se há barra de filtros, nem se o título é *Minhas* ou *Todas*. O esqueleto é obrigatoriamente neutro. **Não está em documento nenhum** | média |
| ~~**R-11**~~ | **Não existe texto exibível para `motivoPausa` do lado do Gestor.** As molduras escrevem *"esperando peça"* e *"Aguardando peça"* — duas redações diferentes para o mesmo motivo, na mesma tela — e **o glossário §4 não tem nenhuma das duas**. Montar a frase no cliente é a segunda cópia da tabela de rótulos, que o contrato §8.8 recusa | ✅ **fechado em 30/08/2026** — o glossário §4 ganhou *"Os motivos, na íntegra"*, com os quatro de pausa e os sete de cancelamento. **As duas redações não eram duas: são duas tabelas**, uma para *o que aconteceu* e outra para *o que você está escolhendo*. A forma curta *"esperando peça"* continua sem autorização |
| **R-12** | **Abreviar nome de pessoa não está autorizado em lugar nenhum.** As molduras escrevem *"Antônio F."* e *"Roberto S."* ao lado de *"Antônio Ferreira"* por extenso, na mesma lista. E `responsavel` nulo tem **dois textos** — *"—"* e *"sem responsável"* | média |
| ~~**R-13**~~ | **O aviso de visibilidade é obrigatório em todo modal com `observacao` — inclusive no `cancelar` do próprio Solicitante**, onde a frase *"O Solicitante vê esta observação"* fica sem sentido, porque quem escreve é ele | ✅ **fechado pelo item 18, em 30/08/2026** — ver abaixo |
| **R-14** | Em T-05, uma `observacao` de **1.000 caracteres** empurra tudo para fora da primeira tela, quebrando a decisão 1 de D-3 — *"sem rolar: rótulo, título e a última entrada"* | média |
| **R-15** | Em T-06, o **vazio que é defeito** chega como **`200` com lista vazia**: o defeito mais grave daquela tela é o único que a API não sinaliza como erro, e quem conta zero é o cliente. Sem `traceId`, sem código | média |
| **R-16** | **O gráfico de recorrência só comporta duas séries** sem cor — e a justificativa do celular na D-5 pressupõe sete. Renderizar as duas mais frequentes é uma **regra de top-N que nenhum documento define** | média |
| **R-17** | Em T-08, o nome de organização de 120 caracteres **é cortado em ~28** no cabeçalho — e T-08 é exatamente a tela onde o Gestor confirma em qual organização está agindo. O nome inteiro não aparece em lugar nenhum dela | média |
| **R-18** | A restrição do **PA-25 custa altura**: com as três opções e as três consequências visíveis ao mesmo tempo, o botão *Aprovar* fica **abaixo da dobra** no celular. Rolar para aprovar é o preço — e a alternativa que caberia é o seletor fechado que produziu o PA-25 | declarado |
| **R-19** | **O Encarregado sem conta só é removível entre o cadastro e a primeira atribuição.** *"Cadastrei o zelador errado"* é engano provável, e a janela para desfazê-lo é curta | média |
| **R-20** | **A ancoragem vertical das quatro telas de credencial não está decidida em lugar nenhum.** As quatro usam menos de um terço da altura, e nada diz se o formulário é topo ou centro | baixa |
| **R-21** | **A regra de força da senha não existe em documento nenhum** — nem no inventário, nem no contrato, nem na arquitetura. É configuração do provedor, e é irmã da Q-T9 | média |
| **R-22** | **As sete categorias-semente são citadas em quatro documentos e enumeradas em nenhum** — nem no enunciado, nem no `openapi.yaml`, nem na POL-01. Quem implementar vai precisar saber quais sete | média |
| **R-23** | **`vinculos.area_id` não tem escritor para quem tem conta.** A unidade existe para descrever o morador, e só é registrável para quem **não** é morador. Detalhado no achado **F13** do inventário, com três saídas e uma recomendação | **alta** |
| **R-24** | **A guarda `PESSOA_COM_CONTA_NAO_EDITAVEL` protege `pessoas`, que é global — mas está aplicada ao endpoint inteiro**, inclusive a `areaId`, que é do vínculo e escopado por organização. O alcance da regra ficou maior que a razão dela | média |
| **R-25** | **Normalizar telefone para E.164 exige biblioteca de terceiro.** É a segunda dependência que este protótipo encosta, e a primeira sem saída barata: sem ela, o `CHECK` do banco recusa o que o formulário produzir | média |
| **R-26** | **A miniatura é gratuita na escrita e paga na leitura.** O upload já está pago — mesma autorização, mesmo slot do limite. Mas exibi-la numa **listagem** custa uma requisição por item, numa plataforma medida em vCPU-segundos e com cold start. Por isso ela entra só em T-05, e como o que pinta primeiro | decisão desta rodada |
| **R-27** | **`ANEXO_JA_REIVINDICADO` é o único erro do produto que anuncia um sucesso**, e por isso é o único cuja cópia contradiz a regra das outras: não diz *"tente de novo"* nem *"escolha a foto de novo"* — diz *"já foi registrada"* e navega. Dizer qualquer outra coisa produz a segunda ocorrência que ele existe para impedir | decisão desta rodada |
| **R-28** | **`PessoaComContato` diz que *"só aparece em `GET /vinculos`"* — e aparece em `GET /pedidos-de-entrada`.** Como `contatos` é tabela **global** e o pedido de entrada só carrega **um** `telefone`, qualquer contato a mais que apareça ali **veio de outra organização**. É a §4.3 do modelo acontecendo por um caminho que ninguém previu | **alta** |
| **R-29** | **`ordem` não tem `UNIQUE (pessoa_id, ordem)`.** Dois contatos podem ter `ordem: 1`, e aí *"a ordem da lista é o significado"* deixa de valer — a tela apresenta um empate como se fosse preferência. A alternativa que o modelo recusou (`principal boolean`) tinha índice único parcial justamente para impedir isso | média |
| **R-30** | **Os exemplos do `openapi.yaml` ainda embutem a unidade no nome** — *"Morador do 302"*, *"Zelador — Bloco B"* —, que é exatamente o que `vinculos.area_id` existe para acabar. Exemplo é a primeira coisa que alguém copia | baixa |
| **R-31** | **O contrato §4.3 e o `openapi.yaml` ainda citam `email_contato`**, que deixou de existir. O argumento em volta continua correto; o nome do campo não | baixa |
| **R-32** | A §8.2 do contrato lista `422 AREA_INVALIDA` para `POST /vinculos`, e **o `openapi.yaml` não declara esse `422`** naquele endpoint. A tela precisa saber se o erro existe para dar-lhe frase | baixa |

> ### O R-13, fechado — 30/08/2026
>
> **O que o achado dizia:** o aviso de visibilidade é obrigatório em todo modal com `observacao`, e no
> `cancelar` do próprio Solicitante a frase *"O Solicitante vê esta observação"* fala do leitor para o
> próprio leitor. **Aberto desde 24/08/2026, e sem dono até o item 18.**
>
> **Como fechou:** o critério **18.7** deu ao modal de `cancelar` **duas** frases, e a escolha é por
> permissão — `ocorrencia.cancelar_qualquer`, nunca autoria:
>
> | Quem está escrevendo | O que o modal mostra |
> |---|---|
> | Tem a permissão — e é o caso dos **cinco** modais | *"O Solicitante vê esta observação. Não há como editá-la depois."* — intacta |
> | **Não** tem — e só o `cancelar` o alcança | *"Os Gestores veem esta observação. Não há como editá-la depois."* |
>
> **`cancelar` é o único dos cinco que duas pessoas diferentes chamam**, então é o único que precisava das
> duas. **Ser Gestor, e não ser o autor:** o síndico morador que cancela a própria ocorrência continua
> lendo o aviso original, porque o aviso existe contra o Gestor que escreve nota interna onde não há canal
> interno.
>
> **A pré-visualização da mesma gaveta trocou junto**, e ela era o R-13 numa terceira superfície:
> `telas.html` rotulava a caixa como *"Assim **ele** vai ler"* na gaveta do Solicitante — *"ele"* era o
> Solicitante, que é quem está escrevendo. Passou a *"Assim os Gestores vão ler"*. **A gaveta de `pausar`
> mantém as duas frases originais**, porque lá quem escreve é o Gestor.
>
> **Onde a redação mora:** `inventario-de-telas.md`, restrição herdada nº 1 — que passou a descrever as
> duas frases com o predicado de cada uma, e a responder as duas perguntas que vinham junto
> (`solucaoAplicada` e o `comentario` da avaliação: **não alcança** nos dois casos, com o motivo escrito).
> *(Item 19 da fila da frente de documentação.)*

### 16.4 · Três bugs que a renderização achou no próprio protótipo

Não são achados de produto: são defeitos do artefato, encontrados por escrevê-lo e corrigidos na hora.
Ficam registrados porque **os três eram invisíveis em ASCII e só apareceram com layout de verdade**.

1. **A escolha única empilhava errado.** Rótulo e consequência sairiam na mesma linha — o oposto exato da
   decisão 3 do PA-25, que existe para deixar as três consequências legíveis ao mesmo tempo.
2. **Rótulo longo fazia a barra do indicador desaparecer.** Um nome de categoria de 60 caracteres empurrava
   a coluna até a barra encolher a 2 px e a linha estourar o cartão: o número sobrevivia, a comparação
   visual morria.
3. **O filtro ligado se distinguia só por cor**, contra o compromisso **A-5**.

E um quarto, de entrega e não de desenho: **o arquivo não declarava codificação**, e o hub exige que ele
abra do sistema de arquivos com dois cliques. Sem `charset`, acento vira lixo em `file://`.

### 16.5 · A tensão que ficou sem conserto

**Três símbolos ainda comunicam sozinhos**, contra o compromisso **A-5**: o `→` da linha de chamada, o `⋯`
dos filtros no celular e o `↻` da coluna de tempo. Todos têm rótulo acessível, mas **nenhum tem palavra
visível** — e A-5 diz que nada é comunicado só por forma ou cor. As molduras originais os introduziram e a
renderização os herdou. **Fica declarado como dívida, não como decisão.**
