---
title: "ADR-0006 · Organização de módulos"
description: "Camada no primeiro nível e agregado no segundo, com as regras de fronteira vivendo no eslint.config.mjs."
---

# ADR-0006 — Organização de módulos: camada no primeiro nível, agregado no segundo

**Status:** Aceita · 21/08/2026 · Complementa a
[ADR-0005](0005-regra-de-dependencia-por-inversao.md)

## Contexto

**Nenhum documento do pacote decidia onde o código mora.** Três dizem explicitamente que não decidem: o
`modelo-de-dados.md` não decide camadas, ORM nem organização de pastas; o `contrato-de-api.md` não escreve
handler, repositório nem estrutura de pastas; a `arquitetura.md` (Parte I, §5) tem a tabela de camadas e
nada sobre arquivos.

A tarefa seguinte do projeto era o esqueleto de deploy, e é nela que a estrutura nasce. Decidir depois não
seria decidir: seria refatorar.

Duas restrições moldam a decisão. **O Next.js impõe o anel externo**, porque rotas de API são
`app/api/**/route.ts` e não há escolha sobre isso. E **há um implementador**, o que muda o cálculo entre
uma estrutura que comunica e uma estrutura que se mantém.

## Decisão

**Camada no primeiro nível, agregado no segundo.**

```
app/                              ← camada Interface, metade externa (imposta pelo Next.js)
  api/<recurso>/route.ts            traduz HTTP, valida formato, MONTA e entrega (ADR-0005)
  (rotas de tela)/                  as telas

src/
  interface/                      ← camada Interface, metade adaptadora
    schemas/                        zod: valida o campo E gera o openapi.yaml (ADR-0007)
    projecoes/                      agregado → OcorrenciaResumo · OcorrenciaDetalhe · …

  aplicacao/<agregado>/           ← camada Aplicação
    <comando>.ts                    uma função por comando de domínio
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

**As duas fusões da §5.1 da `arquitetura.md` viram diretórios, em vez de prosa.** O `app/` mais o
`src/interface/` são a camada Interface; `infraestrutura/repositorios/` mais `infraestrutura/clientes/`
são a camada Infraestrutura. A fronteira que a arquitetura desenha por dentro delas fica visível na
árvore sem que nenhuma camada precise ser renomeada.

### As regras de importação

**1 · Só para dentro.** De `app/` e `src/interface/` para `aplicacao/`, e de `aplicacao/` para
`dominio/`. Nunca ao contrário: apenas elementos das camadas exteriores instanciam os das interiores.

**2 · `infraestrutura/` é importada apenas por `composicao/`.** Nem a Aplicação a importa: ela declara a
porta e recebe a implementação ([ADR-0005](0005-regra-de-dependencia-por-inversao.md)). É a regra que
torna a inversão mecânica em vez de combinada.

**2b · `src/composicao/` é importada apenas pelos caminhos declarados no `eslint.config.mjs`**, hoje
`src/interface/http/`, `src/interface/acoes/` e `semente/`. É mais estrita que a letra da ADR-0005, que
exige apenas que o anel externo monte, e serve ao propósito dela: `app/` não tem como obter porta sem
passar pelo ajudante `comContexto`, e portanto não tem como esquecer de resolver o contexto. Acrescentar
um consumidor é uma linha escrita de propósito naquele arquivo.

Somada à regra 2, o efeito deixa de ser convenção e passa a ser estrutura. Um `route.ts` que não passe
pelo ajudante não tem porta, não tem consulta e não tem cliente: ele não tem *como* falar com o banco.
Não depende de alguém lembrar de usar o ajudante; depende de não existir outro caminho. É a defesa
estrutural do risco número 1 da [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md), e está
verificada por controle negativo, porque `import { Pool } from "pg"` e
`import { montarPortasGlobais } from "@/composicao"` dentro de um `route.ts` são os dois primeiros erros
que o lint aponta.

**3 · Entre módulos da mesma camada, só pela superfície pública.** Cada módulo expõe um `index.ts`, e
ninguém alcança arquivo interno de outro módulo.

**Há ainda regras que não falam de camada**, e por isso não recebem número: `semOrganizacao` só é
importável nos cinco `route.ts` da lista fechada do `contrato-de-api.md` §4.4; `portasDeAnexo` só no
único `route.ts` que emite credencial de upload; `armazenamentoDeAnexos` só nos dois que reivindicam ou
leem anexo. A primeira é a lista fechada da ADR-0003 virada mecanismo: o que aquela ADR exige de uma
exceção nova, revisão explícita, passa a ser uma linha de configuração com o caminho do endpoint escrito
nela.

**Onde as regras moram, e por que este documento não as conta.** Todas vivem em `eslint.config.mjs`,
sobre a regra `no-restricted-imports` do próprio ESLint com `files` por diretório, sem plugin de fronteira
novo. **O `eslint.config.mjs` é a fonte da verdade**, e esta ADR deliberadamente não repete a lista nem o
total. O número já esteve errado duas vezes: a seção nasceu chamada "as três regras de importação" e
passou a cinco, e a 2b nasceu com um consumidor e hoje tem três. Um documento que enuncia o total exige
alteração a cada regra nova; um que aponta para o arquivo, não.

### Quando criar um módulo novo

Dois testes, aplicados na revisão: o componente é **útil**, ou seja, bem definido em limites e
responsabilidade, e é **competente** dentro do que é necessário. Mais a responsabilidade mínima, que é o
mínimo necessário para ser útil dentro de um contexto, com o que existir a mais segregado, e nunca algo
feito pela metade. E o aviso que impede simetria vazia: criar componente não é pegar uma função e dividi-la
em três distribuindo o código.

**Consequência prática:** dos seis agregados, só os que têm comportamento ganham pasta em `dominio/` e
`aplicacao/` nesta entrega. `Notificação` não ganha, porque é evolução prevista, e uma pasta vazia
por simetria falha os dois testes.

## Justificativa

**1 · Por camada é o que a regra de dependência precisa.** A regra 2 acima só é verificável se
`infraestrutura/` for um caminho. Com organização por funcionalidade, a mesma regra teria de ser escrita
como "dentro de cada módulo, o subdiretório `infra` só é importado pelo subdiretório `composicao`", que é
mais frágil de escrever e de conferir, e multiplicada por seis.

**2 · A regra de lint fica mais estreita.** Ela deixa de ser "nada fora da Infraestrutura importa o
cliente de banco" e passa a ser "nada fora de `infraestrutura/clientes/` importa um SDK". O conjunto
autorizado encolhe de uma camada inteira para um diretório, e o mesmo mecanismo passa a cobrir Blob
Storage e Supabase Auth, que a redação anterior não alcançava por falar só em cliente de banco.

**3 · O controller inchado já está neutralizado, e a estrutura preserva isso.** O Next.js exige um
`route.ts` por caminho, então os endpoints nascem separados, e o antipadrão não tem como se formar por
acúmulo. É uma das poucas vezes em que a restrição do framework empurra na direção certa.

**4 · O tamanho do projeto favorece a estrutura menor.** São seis agregados de peso muito desigual:
`Ocorrência` é quase tudo, `Notificação` é vazio nesta entrega. Camada no topo produz quatro
diretórios estáveis; agregado no topo produziria seis diretórios com quatro subdiretórios cada, a maioria
vazia.

**5 · `src/interface/schemas/` fecha um círculo que já estava decidido.** A
[ADR-0007](0007-camada-de-interface-com-shadcn-ui.md) escolheu `zod` para validar o formulário, e a §15 do
`contrato-de-api.md` determina que o `openapi.yaml` seja gerado dos schemas de validação. Um lugar só para
eles é o que faz "o schema que valida o campo é o mesmo que gera a especificação" deixar de ser intenção.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Colocation por funcionalidade, `app/ocorrencias/{page.tsx, actions.ts, queries.ts, db.ts}`, que é o padrão que o Next.js sugere | Põe o domínio ao lado da rota, que é onde a lógica de transição evapora sob pressão de prazo. É o modo de falha que a §5 da `arquitetura.md` existe para impedir. O atalho compensa numa aplicação simples, e esta tem uma máquina de estados auditável no meio |
| Agregado no primeiro nível, a chamada *screaming architecture*, com `src/ocorrencias/{dominio,aplicacao,infra}` | Comunica melhor o que o sistema faz, e é a escolha certa em base grande com vários times. Aqui multiplica diretórios quase vazios por seis e torna a regra 2 intra-módulo, o que a deixa mais frágil. Registrado porque é a alternativa boa: se o produto crescer e `Notificação` for extraída, é para cá que se migra |
| Sem estrutura declarada, deixando nascer no esqueleto | Era o estado anterior, e é o que esta ADR existe para não deixar acontecer. O custo de decidir agora é uma tabela; o de decidir depois é mover arquivos com o histórico de git junto |
| Espelhar os nomes dos anéis da Clean Architecture (`entities/`, `usecases/`, `adapters/`, `frameworks/`) | Discordaria de onze documentos que falam em Interface, Aplicação, Domínio e Infraestrutura. A §5.1 da `arquitetura.md` resolve isso com um de-para, que custa uma tabela em vez de uma refatoração de referências cruzadas |

## Consequências

**Positivas**

- A regra de dependência da [ADR-0005](0005-regra-de-dependencia-por-inversao.md) vira caminho de arquivo,
  que é o que uma regra de lint sabe conferir.
- As duas fusões de nome que a §5.1 da `arquitetura.md` documenta ficam visíveis na árvore, sem renomear
  camada nenhuma.
- O esqueleto de deploy nasce com lugar para cada coisa, e ninguém precisa perguntar onde uma classe nova
  deve ficar.
- Um lugar só para os schemas `zod`, servindo formulário e `openapi.yaml`.

**Negativas e custos assumidos**

- **A árvore não grita o domínio.** Quem abre o repositório vê camadas, e não ocorrências. É a perda real
  desta escolha, e está registrada acima como a alternativa boa que ficou de fora.
- **Uma mudança num agregado toca quatro diretórios.** Acrescentar um comando mexe em `dominio/`,
  `aplicacao/`, possivelmente `interface/projecoes/` e `infraestrutura/repositorios/`. Com um
  implementador isso é atrito de navegação, e não de coordenação, e o `index.ts` por módulo reduz a
  superfície.
- **A estrutura é uma aposta feita antes do código.** Se o esqueleto mostrar que um diretório não paga, a
  correção é outra ADR, e não uma exceção silenciosa.

## O que esta ADR não decide

- **Não decide nomes de arquivo nem convenção de exportação** além do `index.ts` por módulo.
- **Não decide a estrutura das telas** dentro de `app/`. O inventário de telas define quais são; como elas
  se organizam em rotas é decisão do esqueleto.
- **Não renomeia as quatro camadas.** O de-para com os anéis da Clean Architecture está em
  `arquitetura.md` §5.1, e a decisão de não renomear está justificada lá.

## Fontes

- [ADR-0005](0005-regra-de-dependencia-por-inversao.md), a regra de dependência que esta estrutura torna
  verificável.
- [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md) e a §15 do `contrato-de-api.md`, a origem única
  dos schemas.
- `eslint.config.mjs`, que é onde as regras de fronteira vivem e são conferidas.
