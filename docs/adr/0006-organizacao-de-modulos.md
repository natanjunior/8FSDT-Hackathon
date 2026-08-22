# ADR-0006 — Organização de módulos: camada no primeiro nível, agregado no segundo

**Status:** Aceita · 21/08/2026 · **Complementa a [ADR-0005](0005-regra-de-dependencia-por-inversao.md)**

## Contexto

**Nenhum documento do pacote decide onde o código mora.** Três dizem explicitamente que não decidem:

- `modelo-de-dados.md`: *"Não decide camadas, ORM nem **organização de pastas**."*
- `contrato-de-api.md`: *"Não escreve handler, repositório nem **estrutura de pastas**."*
- `arquitetura.md` (Parte I, §5): tem a tabela de camadas e nada sobre arquivos.

A próxima tarefa do projeto é o **esqueleto de deploy**, e é nela que a estrutura nasce. Decidir depois não
é decidir — é refatorar.

Duas restrições moldam a decisão. **O Next.js impõe o anel externo**: rotas de API são `app/api/**/route.ts`
e não há escolha sobre isso. E **há um implementador**, o que muda o cálculo entre "estrutura que comunica"
e "estrutura que se mantém".

A disciplina de **Clean Architecture da Fase 5** tem exatamente uma estrutura de referência, na aula 8
(transcrição 01), e é **por camada**:

```
Adapters/  API/  Controller/  Entities/  External/  Gateways/  Interfaces/  Types/  UseCases/
```

E tem uma receita para o nosso caso — framework robusto —, na aula 7 (p.12):

> *"Usar as ferramentas do framework **a favor da estrutura do software, e não basear o código no que o
> framework indica**... podemos **isolar todo o acesso a dados em uma camada**... Outro ponto é **isolar os
> casos de uso em relação aos Controllers, em uma biblioteca dentro do software**."*

O critério de **agrupamento** vem da decomposição do *fat controller* (aula 7, transcrição 02), e é **por
agregado**: `VendaController`, `ClienteController`, `VendedorController` — nunca um controller que
*"tem responsabilidade em relação a venda, a cliente, e a vendedor"*.

## Decisão

**Camada no primeiro nível, agregado no segundo.**

```
app/                              ← camada Interface, metade externa (imposta pelo Next.js)
  api/<recurso>/route.ts            traduz HTTP, valida formato, MONTA e entrega (ADR-0005)
  (rotas de tela)/                  as dez telas

src/
  interface/                      ← camada Interface, metade adaptadora
    schemas/                        zod: valida o campo E gera o openapi.yaml (ADR-0007, §15 do contrato-de-api.md)
    projecoes/                      agregado → OcorrenciaResumo · OcorrenciaDetalhe · … (arquitetura.md §5.5)

  aplicacao/<agregado>/           ← camada Aplicação
    <comando>.ts                    uma função por comando de domínio (arquitetura.md §5.4)
    consultas.ts                    os modelos de leitura
    portas.ts                       AS INTERFACES QUE ESTA CAMADA CONSOME (ADR-0005)

  dominio/<agregado>/             ← camada Domínio
    <Agregado>.ts                   a raiz, os comandos, as invariantes
    <ObjetoDeValor>.ts

  infraestrutura/
    repositorios/<agregado>/      ← implementam as portas; devolvem AGREGADO, nunca linha
    clientes/                     ← banco, storage, auth: o ÚNICO lugar que importa SDK
    contexto/                       o ponto único de resolução de escopo (ADR-0003)

  composicao/                     ← o ponto de composição: monta o grafo, não decide regra
```

**As duas fusões da §5.1 da `arquitetura.md` viram diretórios, não prosa.** `app/` mais `src/interface/` são a camada
Interface; `infraestrutura/repositorios/` mais `infraestrutura/clientes/` são a camada Infraestrutura. A
fronteira que a Clean Architecture desenha por dentro delas fica **visível na árvore** sem que nenhuma
camada precise ser renomeada.

### As regras de importação

**1 · Só para dentro.** `app/` e `src/interface/` → `aplicacao/` → `dominio/`. Nunca ao contrário. É a
regra da aula 2 (p.11): *"apenas elementos das camadas exteriores podem instanciar os elementos das
camadas interiores"*.

**2 · `infraestrutura/` é importada apenas por `composicao/`.** Nem a Aplicação a importa — ela declara a
porta e **recebe** a implementação ([ADR-0005](0005-regra-de-dependencia-por-inversao.md)). Esta é a regra
que torna a inversão mecânica em vez de combinada.

**3 · Entre módulos da mesma camada, só pela superfície pública.** Cada módulo expõe um `index.ts`; ninguém
alcança arquivo interno de outro módulo. É o que faz *"componentes podem fazer parte de componentes"*
(aula 1, transcrição 03) ser verificável.

> ### Emenda de 22/08/2026 — duas regras que o esqueleto descobriu serem necessárias
>
> **Esta seção se chamava "As três regras de importação"**, e trazia só as três acima. O esqueleto de
> deploy acrescentou mais duas, e as duas existem porque as três não bastavam: a regra 2 mantém a Aplicação
> longe da Infraestrutura e **não impedia um `route.ts` de montar o grafo por conta própria** — que é
> exatamente o caminho por onde a resolução de contexto se perde.
>
> **2b · `src/composicao/` é importada apenas por `src/interface/http/`.** É mais estrita que a letra da
> [ADR-0005](0005-regra-de-dependencia-por-inversao.md), que exige apenas que **o anel externo** monte, e
> serve exatamente ao propósito dela. Somada à regra 2, o efeito deixa de ser convenção e passa a ser
> estrutura: **`app/` não alcança `infraestrutura/` nem `composicao/`, então um `route.ts` que não passe
> pelo ajudante `comContexto` não tem porta, não tem consulta e não tem cliente — ele não tem *como* falar
> com o banco.** Não é o desenvolvedor lembrar de usar o ajudante; é não existir outro caminho. É a defesa
> estrutural do risco nº 1 da [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md), e está
> verificada por controle negativo: `import { Pool } from "pg"` e `import { montarPortasGlobais } from
> "@/composicao"` dentro de um `route.ts` são os dois primeiros erros que o lint aponta.
>
> **E uma quinta, que não recebe número porque não fala de camada:** `semOrganizacao` só é importável nos
> **quatro `route.ts` da lista fechada** do `contrato-de-api.md` §4.4 — `GET /contexto`, `PUT /contexto/organizacao`,
> `POST /organizacoes` e `POST /pedidos-de-entrada`. O quinto endpoint que tentar **não passa no lint**. Ela
> é a lista fechada da ADR-0003 virada mecanismo: o que aquela ADR exige de uma exceção nova — *"revisão
> explícita"* — passa a ser **uma linha de configuração com o caminho do endpoint escrito nela**, e três dos
> quatro caminhos já estão lá, reservados para endpoints que ainda não existem.
>
> **Onde as cinco moram:** em `eslint.config.mjs`, sobre a regra `no-restricted-imports` do próprio ESLint
> com `files` por diretório — sem plugin de fronteira novo. A escolha da ferramenta, e sobretudo **o que
> ela não alcança**, estão documentados naquele arquivo.

### Quando criar um módulo novo

Os dois testes da aula 6 (p.5), aplicados na revisão:

> *"(1) se este componente é **útil**, ou seja, se ele é bem definido em seus limites e responsabilidade, e
> (2) se ele é **competente** dentro do que é necessário."*

Mais a regra da responsabilidade mínima (p.7): *"o mínimo possível para que seja útil dentro de um
contexto; o que existir a mais deve ser segregado, **e não deve fazer algo de forma incompleta**"*. E o
aviso que impede simetria vazia (transcrição 01): *"**criar componente não é pegar uma função e dividir ela
em três** distribuindo o código."*

**Consequência prática:** dos seis agregados, só os que têm comportamento ganham pasta em `dominio/` e
`aplicacao/` na primeira entrega. `Notificação` não ganha — é evolução prevista, e uma pasta vazia por
simetria falha os dois testes.

## Justificativa

**1 · Por camada é o que a disciplina mostra, e é o que a regra de dependência precisa.** A regra 2 acima
só é verificável se `infraestrutura/` for um caminho. Com organização por funcionalidade, a mesma regra
teria de ser escrita como *"dentro de cada módulo, o subdiretório `infra` só é importado pelo subdiretório
`composicao`"* — mais frágil de escrever e de conferir, e multiplicada por seis.

**2 · A regra de lint fica mais estreita.** Ela deixa de ser *"nada fora da Infraestrutura importa o cliente
de banco"* e passa a ser **"nada fora de `infraestrutura/clientes/` importa um SDK"**. O conjunto autorizado
encolhe de uma camada inteira para um diretório — e o mesmo mecanismo passa a cobrir Blob Storage e Supabase
Auth, que a redação anterior não alcançava por falar só em "cliente de banco".

**3 · O `fat controller` já está neutralizado, e a estrutura preserva isso.** O Next.js exige um `route.ts`
por caminho, então os **37 endpoints nascem separados** — o antipadrão da aula 7 não tem como se formar por
acúmulo. É uma das poucas vezes em que a restrição do framework empurra na direção certa, e vale registrar
justamente porque a mesma aula alerta para o risco oposto (*"jockey de framework"*).

**4 · O tamanho do projeto favorece a estrutura menor.** Seis agregados de peso muito desigual — `Ocorrência`
é quase tudo, `Notificação` é vazio na primeira entrega. Camada no topo produz quatro diretórios estáveis;
agregado no topo produziria seis diretórios com quatro subdiretórios cada, a maioria vazia.

**5 · `src/interface/schemas/` fecha um círculo que já estava decidido.** A [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md)
escolheu `zod` para validar o formulário, e a §15 do `contrato-de-api.md` determina que o `openapi.yaml` passe a ser
gerado dos schemas de validação. Um lugar só para eles é o que faz *"o schema que valida o campo é o mesmo
que gera a especificação"* deixar de ser intenção.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **Colocation por funcionalidade** — `app/ocorrencias/{page.tsx, actions.ts, queries.ts, db.ts}`, que é o padrão que o Next.js sugere | É exatamente o que a aula 7 (transcrição 02) desaconselha: *"[o framework] fala para eu fazer aqui, já na própria API, o controller e o acesso no banco de dados porque é mais rápido... **Se você já está usando um framework para criar uma aplicação mais complexa, faz sentido seguir essa orientação básica? Não.**"* E põe o domínio **ao lado da rota**, que é precisamente onde a lógica de transição evapora sob pressão de prazo — o modo de falha que a §5 da `arquitetura.md` existe para impedir |
| **Agregado no primeiro nível** (*screaming architecture*) — `src/ocorrencias/{dominio,aplicacao,infra}` | Comunica melhor o que o sistema faz, e é a escolha certa em base grande com vários times. Aqui: multiplica diretórios quase vazios por seis, torna a regra 2 intra-módulo (mais frágil), e **contraria a única referência que a disciplina oferece**. Registrado porque é a alternativa boa — se o produto crescer e `Notificação` for extraída (`arquitetura.md` §2), é para cá que se migra |
| **Sem estrutura declarada** — deixar nascer no esqueleto | É o estado atual, e é o que esta ADR existe para não deixar acontecer. O custo de decidir agora é uma tabela; o de decidir depois é mover arquivos com o histórico de git junto |
| **Espelhar os nomes dos anéis** (`entities/`, `usecases/`, `adapters/`, `frameworks/`) | Ficaria fiel à disciplina e **discordaria de onze documentos** que falam em Interface, Aplicação, Domínio e Infraestrutura. A §5.1 da `arquitetura.md` resolve isso com um de-para, que custa uma tabela em vez de uma refatoração de referências cruzadas |

## Consequências

**Positivas**

- A regra de dependência da [ADR-0005](0005-regra-de-dependencia-por-inversao.md) vira **caminho de
  arquivo**, que é o que uma regra de lint sabe conferir.
- As duas fusões de nome que a §5.1 da `arquitetura.md` documenta ficam **visíveis na árvore**, sem renomear camada nenhuma.
- O esqueleto de deploy nasce com lugar para cada coisa — que é o benefício que a disciplina persegue desde
  a aula 1 (transcrição 02): *"eu não sei onde eu tenho que colocar essa classe"*.
- Um lugar só para os schemas `zod`, servindo formulário e `openapi.yaml`.

**Negativas e custos assumidos**

- **A árvore não "grita" o domínio.** Quem abre o repositório vê camadas, não ocorrências. É a perda real
  desta escolha, e está registrada acima como a alternativa boa que ficou de fora.
- **Uma mudança num agregado toca quatro diretórios.** Acrescentar um comando mexe em `dominio/`,
  `aplicacao/`, possivelmente `interface/projecoes/` e `infraestrutura/repositorios/`. Com um implementador
  isso é atrito de navegação, não de coordenação — e o `index.ts` por módulo reduz a superfície.
- **A regra de acoplamento entre módulos é [FONTE EXTERNA].** A disciplina **não ensina os princípios de
  componente do livro** — REP, CCP, CRP, ADP, SDP, SAP não aparecem em nenhuma das oito aulas, nem os
  nomes, e **não há regra de aciclicidade**. O que ela oferece é *"responsabilidade mínima"* e *"contexto
  de uso"*, que são orientações. A regra 3 acima se sustenta por mérito próprio, como a multi-tenancy.
- **A estrutura é uma aposta feita antes do código.** Se o esqueleto mostrar que um diretório não paga, a
  correção é outra ADR — não uma exceção silenciosa.

## Escopo — o que esta ADR não decide

- **Não decide nomes de arquivo nem convenção de exportação** além do `index.ts` por módulo.
- **Não decide a estrutura das telas** dentro de `app/`. O inventário de telas define as dez; como elas se
  organizam em rotas é decisão do esqueleto.
- **Não renomeia as quatro camadas.** O de-para com os anéis da Clean Architecture está em
  `arquitetura.md` §5.1, e a decisão de **não renomear** está justificada lá.

## Fontes

- **aula 8, transcrição 01** — a única estrutura de diretórios da disciplina, em TypeScript.
- **aula 7, p.12** — a receita para framework robusto: isolar acesso a dados; isolar casos de uso.
- **aula 7, transcrição 02** — o *fat controller*, a decomposição por agregado, e *"framework é ferramenta,
  não base"*.
- **aula 6, p.5–7 e transcrição 01** — os dois testes do componente e a responsabilidade mínima.
- **aula 2, p.11** — camada exterior instancia a interior, nunca o contrário.
- **aula 1, transcrição 03** — componentes podem fazer parte de componentes.
- **ADR-0005** — a regra de dependência que esta estrutura torna verificável.
- **ADR-0007** e §15 de `contrato-de-api.md` — a origem única dos schemas.
- **[FONTE EXTERNA]** — a regra de superfície pública por módulo (regra 3) não tem respaldo nas oito aulas.
