---
title: "Documentação do Resolve Aí"
description: "O índice da documentação da solução, com o que cada documento contém e por onde começar."
---

# Resolve Aí — Documentação

Plataforma de Gestão de Ocorrências. Permite que moradores, funcionários ou membros de uma organização
registrem ocorrências — iluminação, vazamento, limpeza, segurança, manutenção — e acompanhem o processo
até a resolução, com trilha auditável de cada mudança de status.

Trabalho da Fase 5 da pós-graduação em Full Stack Development (FIAP).

---

## Conteúdo desta pasta

Esta pasta contém a documentação da solução. O material de terceiros e o de processo interno ficam fora
do repositório.

Os documentos abaixo estão na **ordem em que foram produzidos**, e cada um usa o anterior. O número é
identificador, não posição de leitura: quem entra agora encontra as duas trilhas logo depois da tabela.

| # | Documento | O que contém |
|---|---|---|
| 01 | **[Documentação da Demanda](documentacao-da-demanda.md)** | Personas, o problema e a jornada atual, objetivos com métrica, jornada da solução em 11 etapas, requisitos funcionais e não funcionais quantificados, e análise de riscos |
| 02 | **[Escopo](escopo.md)** | O que o produto é quando completo, o que entra nesta entrega, o que ficou para depois e por quê, e a evolução prevista |
| 03 | **[Glossário](glossario.md)** | A linguagem ubíqua do projeto: uma definição por termo, o que não confundir com o quê, as cinco colisões de vocabulário que ele resolve, e os termos deliberadamente não usados |
| 04 | **[Arquitetura](arquitetura.md)** | Design estratégico, com subdomínios, contextos delimitados, mapa de contexto, o agregado `Ocorrência` com a tabela de transições e as camadas, mais o Documento de Requisito Técnico da Solução |
| 05 | **[Modelo de Dados](modelo-de-dados.md)** | Esquema físico em PostgreSQL: diagrama ER, uma seção por tabela com índices justificados, decisões de modelagem, e como cada invariante do domínio é garantida |
| 06 | **[Contrato de API](contrato-de-api.md)** | A superfície HTTP: como comando de domínio vira endpoint sem tornar o status escrevível, onde vive a organização, o modelo de erros, e a rastreabilidade de cada endpoint até a capacidade que ele realiza. A especificação executável está em [api/openapi.yaml](api/openapi.yaml), em OpenAPI 3.1 |
| 07 | **[Fluxos e Diagramas](fluxos-e-diagramas.md)** | Os fluxos que o texto explica pior: o comando de transição de ponta a ponta, a resolução de contexto, a entrada na organização, o registro com imagem — mais a relação de cada um com os três fluxogramas do enunciado, e a lista do que foi deliberadamente não desenhado |
| 08 | **[Inventário de Telas](inventario-de-telas.md)** | As telas desta entrega: o que cada uma responde, o que oferece e qual endpoint chama; os estados vazio, carregando e erro; o mapa de navegação; e a lista do que não virou tela |
| 09 | **[Registros de Decisão de Arquitetura](adr/)** | Uma decisão por arquivo, no formato Nygard, cada uma com o contexto, as alternativas rejeitadas e as consequências — inclusive as ruins. O índice, com o status de cada uma, está em **[adr/README.md](adr/README.md)** |
| 10 | **[Premissas e Questões Abertas](premissas-e-questoes-abertas.md)** | As premissas assumidas sem confirmação, com o que muda em cada caso se estiverem erradas; os pontos de atenção em aberto; as divergências encontradas nas fontes do enunciado |
| 11 | **[Definition of Done e Definition of Ready](definition-of-done.md)** | Os dois portões de qualidade do projeto, cada critério justificado pelo defeito que ele previne, e cada redução em relação ao portão completo justificada item a item |
| 12 | **[Protótipo Low-Fi](prototipo-low-fi.md)** | A forma das telas: o orçamento de tempo do registro em menos de um minuto, que é o único requisito cronometrado do projeto, os desenhos em baixa fidelidade, e o que desenhar descobriu |
| 13 | **[Event Storming](event-storming.md)** | O workshop de descoberta do domínio: os eventos, os comandos e quem os dispara, as onze políticas, os modelos de leitura por ator, e os seis agregados e dois contextos que saíram dali |

**O número é identificador, e não fim de fila.** O protótipo é o 12 e lê-se logo depois do inventário de
telas, que é o 08, porque foi produzido ali. Renumerar 09, 10 e 11 para encostar os dois quebraria
referências que outros documentos já fazem por número, e identificador serve para ser estável.

---

## Por onde começar

**Caminho curto.** [O produto em uma passada](escopo.md#o-produto-em-uma-passada), na abertura do Escopo,
conta do cadastro ao dashboard como quem usa o encontra: registrar uma ocorrência, triar, atribuir,
resolver, avaliar, e a trilha que grava cada passo. De lá:
[Arquitetura](arquitetura.md) para o mecanismo, e a
[ADR-0001](adr/0001-historico-de-transicoes-como-conceito-de-dominio.md) para a decisão que sustenta o
resto — a auditabilidade como invariante do agregado, e não como convenção do time.

**Caminho completo.** A ordem 01 a 13 da tabela acima.

Se a pergunta for específica, o atalho é outro:

| A pergunta | Onde ela é respondida |
|---|---|
| *Por que este produto existe?* | [Documentação da Demanda](documentacao-da-demanda.md) §2 — as duas jornadas atuais, narradas |
| *O que entra e o que não entra?* | Escopo, partes 2 e 3 — com o motivo de cada corte |
| *Como a auditabilidade é garantida?* | ADR-0001, e a tabela de transições em [Arquitetura](arquitetura.md) Parte I §4 |
| *Como um condomínio não vê o dado do outro?* | ADR-0003, e a §4 do [Modelo de Dados](modelo-de-dados.md) |
| *O que a API expõe?* | `api/openapi.yaml` no Swagger; o porquê de cada escolha, no Contrato de API |
| *O que ainda não se sabe?* | Premissas e Questões Abertas — as premissas, os pontos de atenção em aberto e as divergências das fontes |

---

## Como o modelo foi construído

Duas fontes, nesta ordem de autoridade.

**O enunciado do desafio.** Todo requisito dele é obrigatório, e está inventariado item a item na
Documentação da Demanda. Onde o enunciado define o quê *e* o como, ele é seguido literalmente; onde apenas
exige que algo exista, a forma foi decidida aqui, e a decisão está escrita com o que foi rejeitado.

**Descoberta própria.** Um Event Storming, que produziu os eventos, os comandos, as políticas e os modelos
de leitura; a experiência de um integrante do time, que é síndico do condomínio onde mora; e um benchmark
de sistemas de gestão de condomínio, de softwares de manutenção, de service desk e de plataformas cívicas
de relato. Não houve entrevista com pessoas de fora do time, que é a limitação declarada na premissa
`P5`, e a que mais escopo destravaria se fosse resolvida.

O vocabulário de modelagem é o de Domain-Driven Design: agregado, contexto delimitado, linguagem ubíqua,
Event Storming. Cada lugar onde ele é aplicado traz o motivo ao lado, porque uma prática que precisa de
citação para se sustentar não está sustentada.

**O corte de escopo separa obrigação de escolha.** Nenhum requisito do enunciado ficou de fora: tudo o que
foi cortado é adição nossa, e o [Escopo](escopo.md) diz qual, por quê, e o que custaria trazer de volta.

---

## Os identificadores

Decisões de produto são citadas por identificador, `D1` a `D27`; premissas por `P1` a `P5`; pontos de
atenção por `PA-nn`. Eles são estáveis, e atravessam todos os documentos.

---

## Como as seções se citam

Os documentos se referem às seções uns dos outros o tempo todo. A convenção existe para que uma referência
possa ser **conferida por máquina**, e é de uma regra só:

> **`§N` sozinho é sempre deste documento. Para citar outro, o nome do arquivo acompanha o número.**

Duas formas são aceitas, porque o português não aceita uma só — o nome **antes**, *"a `arquitetura.md`
Parte I §4 decide"*, e o nome **depois, com a preposição**, *"a §4.3 do `modelo-de-dados.md`"*. Vale também
como **link**, quando o alvo é o arquivo: *"a §4 do [Modelo de Dados](modelo-de-dados.md)"*. Uma cadeia
herda o marcador de qualquer uma das pontas: em *"`modelo-de-dados.md` §6.16 e §7.8"*, as duas são de lá.
O que **não** vale é o nome solto na frase, longe do número — aí quem lê, e quem verifica, adivinha.

**O que a regra compra.** Sem ela, a única pergunta que uma ferramenta consegue fazer é *"este número existe
em algum documento do pacote?"*. Uma seção renumerada num documento continua existindo em outro, e a
referência quebrada passa calada. Com ela a pergunta vira *"existe no documento certo?"*, que é a que
interessa.

**A normalização retroativa foi deliberadamente parcial** (22/08/2026): entraram o
[Contrato de API](contrato-de-api.md) e o [Inventário de Telas](inventario-de-telas.md), os dois documentos
que mais citam para fora. Nos demais a convenção vale para o que for escrito de agora em diante, e converge
conforme cada um for tocado por outro motivo. Percorrer todas as citações do pacote de uma vez custaria mais
do que o erro que evitaria.
