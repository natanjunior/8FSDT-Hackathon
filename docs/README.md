# Resolve Aí — Documentação

Plataforma de Gestão de Ocorrências. Permite que moradores, funcionários ou membros de uma organização
registrem ocorrências — iluminação, vazamento, limpeza, segurança, manutenção — e acompanhem o processo
até a resolução, com trilha auditável de cada mudança de status.

Trabalho da Fase 5 da pós-graduação em Full Stack Development (FIAP).

---

## Conteúdo desta pasta

Esta pasta contém a documentação da solução. Material de terceiros — o enunciado do desafio e as
apostilas das aulas — e o material de processo interno ficam fora do repositório.

Os documentos abaixo estão na ordem em que foram produzidos, que é também a ordem de leitura: cada um
usa o anterior.

| # | Documento | O que contém |
|---|---|---|
| 01 | **[Documentação da Demanda](documentacao-da-demanda.md)** | Personas, o problema e a jornada atual, objetivos com métrica, jornada da solução em 11 etapas, requisitos funcionais e não funcionais quantificados, e análise de riscos |
| 02 | **[Escopo](escopo.md)** | O que o produto é quando completo, o que entra na primeira entrega, o que ficou para depois e por quê, e a evolução prevista |
| 03 | **[Glossário](glossario.md)** | A linguagem ubíqua do projeto: cerca de 56 termos com uma definição cada, o que não confundir com o quê, cinco colisões de vocabulário resolvidas, e os termos deliberadamente não usados |
| 04 | **[Arquitetura](arquitetura.md)** | Design estratégico — subdomínios, contextos delimitados, mapa de contexto, o agregado `Ocorrência` com a tabela de transições e as camadas — e o Documento de Requisito Técnico da Solução |
| 05 | **[Modelo de Dados](modelo-de-dados.md)** | Esquema físico em PostgreSQL: diagrama ER, uma seção por tabela com índices justificados, decisões de modelagem, e como cada invariante do domínio é garantida |
| 06 | **[Contrato de API](contrato-de-api.md)** | A superfície HTTP: como comando de domínio vira endpoint sem tornar o status escrevível, onde vive a organização, o modelo de erros, e a rastreabilidade de cada endpoint até a capacidade que ele realiza. A especificação executável está em **[api/openapi.yaml](api/openapi.yaml)**, em OpenAPI 3.1 |
| 07 | **[Fluxos e Diagramas](fluxos-e-diagramas.md)** | Os fluxos que o texto explica pior: o comando de transição de ponta a ponta, a resolução de contexto, a entrada na organização, o registro com imagem — mais a relação de cada um com os três fluxogramas do enunciado, e a lista do que foi deliberadamente **não** desenhado |
| 08 | **[Inventário de Telas](inventario-de-telas.md)** | As dez telas da primeira entrega: o que cada uma responde, o que oferece e qual endpoint chama; os estados vazio, carregando e erro; o mapa de navegação; e a lista do que **não** virou tela |
| 09 | **[Registros de Decisão de Arquitetura](adr/)** | Quatro decisões, no formato Nygard: o histórico de transições como conceito de domínio, a stack, o isolamento entre organizações, e a execução em container |
| 10 | **[Premissas e Questões Abertas](premissas-e-questoes-abertas.md)** | As premissas assumidas sem confirmação, com o que muda em cada caso se estiverem erradas; os pontos de atenção em aberto; as divergências encontradas nas fontes do enunciado |
| 11 | **[Definition of Done e Definition of Ready](definition-of-done.md)** | Os dois portões de qualidade do projeto, com as reduções em relação ao material do curso justificadas item a item |

---

## Como o modelo foi construído

Três fontes, nesta ordem de autoridade:

1. **O enunciado do desafio.** Todo requisito dele é obrigatório e está inventariado item a item na
   Documentação da Demanda. Onde o enunciado define o quê *e* o como, ele é seguido literalmente; onde
   apenas exige que algo exista, a forma foi decidida no projeto.
2. **O material da disciplina de DDD da Fase 1** — nove aulas. Cada prática adotada é citada como
   `aula N, p.X`. O que veio de fora da disciplina está marcado **[FONTE EXTERNA]**.
3. **Descoberta própria** — Event Storming pelos dez passos da aula 6, entrevista de domínio, e benchmark
   de mercado sobre sistemas de gestão de condomínio, softwares de manutenção, service desk e plataformas
   cívicas de relato.

---

## Marcadores de origem

Todo requisito e toda decisão nos documentos carregam a origem. A distinção define o que é obrigação e o
que é escolha:

| Marcador | Significado | Pode ser cortado? |
|---|---|---|
| `ENUNCIADO · literal` | O enunciado define o quê **e** o como | **Não** |
| `ENUNCIADO · aberto` | A existência é imposta; a forma é decisão do projeto | **Não** (a existência) |
| `NOSSO` | Adição do projeto — justificada em valor contra custo | **Sim** |

Decisões de produto são referenciadas por identificador (`D1` a `D27`), premissas por `P1` a `P5`, e
pontos de atenção por `PA-nn`. Os identificadores são estáveis e usados em todos os documentos.
