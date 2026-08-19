# Resolve Aí — Documentação de Entrega

Plataforma de Gestão de Ocorrências. Trabalho da Fase 5 da pós em Full Stack Development (FIAP).

Esta pasta contém **só o que vai ser entregue**. O material de apoio — enunciado, PDFs das aulas,
depósito de ideias, registro de decisões em andamento — fica fora do repositório, porque é material de
terceiros ou processo interno.

---

## Por onde começar

A ordem abaixo é a ordem em que os documentos foram produzidos, e é também a melhor ordem de leitura:
cada um usa o anterior.

| # | Documento | O que responde | Tamanho |
|---|---|---|---|
| 1 | **[Documentação da Demanda](documentacao-da-demanda.md)** | Para quem é, qual o problema, como funciona hoje, o que queremos que passe a funcionar, e os requisitos | ~15 min |
| 2 | **[Glossário](glossario.md)** | O vocabulário do projeto. Uma definição por termo, e o que **não** confundir com o quê | ~10 min |
| 3 | **[Arquitetura](arquitetura.md)** | O desenho técnico: contextos, o agregado central, a tabela de transições, e os 10 tópicos do requisito técnico | ~25 min |
| 4 | **[Registros de Decisão (ADR)](adr/)** | Três decisões de arquitetura, cada uma com as alternativas rejeitadas e as consequências ruins | ~15 min |
| 5 | **[Premissas e Questões Abertas](premissas-e-questoes-abertas.md)** | O que assumimos sem ter certeza, e o que ainda não sabemos | ~10 min |
| 6 | **[Definition of Done / Ready](definition-of-done.md)** | Os dois portões de qualidade: quando uma tarefa pode começar, e quando está pronta | ~8 min |

**Se você só tiver 10 minutos:** leia a seção 2 da Documentação da Demanda (o problema e a jornada atual)
e a seção 1 das Premissas. São as duas que mais precisam de gente conferindo.

---

## Como este pacote foi construído

Três fontes, nesta ordem de autoridade:

1. **O enunciado do desafio** — todo requisito dele é obrigatório e está inventariado. Onde ele define o
   quê *e* o como, seguimos literalmente; onde só exige que algo exista, a forma foi decidida por nós.
2. **O material da disciplina de DDD da Fase 1** — 9 aulas. Cada prática adotada é citada como
   `aula N, p.X`. O que veio de fora está marcado **[FONTE EXTERNA]**, porque a distinção importa.
3. **Descoberta própria** — Event Storming pelos 10 passos da aula 6, entrevista de domínio, e benchmark
   de mercado (sistemas de condomínio, CMMS de manutenção, service desk e apps cívicos).

Toda decisão nossa carrega um marcador de origem:

| Marcador | Significa | Pode ser cortado? |
|---|---|---|
| `ENUNCIADO · literal` | O enunciado define o quê **e** o como | **Não** |
| `ENUNCIADO · aberto` | A existência é imposta; a forma é nossa | **Não** (a existência) |
| `NOSSO` | Adição nossa — precisa justificar valor contra custo | **Sim** |

---

## O que precisamos de vocês

O pacote está completo, mas **não está validado**. Quatro frentes de revisão, e nenhuma exige
conhecimento técnico:

### A · A realidade do problema
**Onde:** [Documentação da Demanda](documentacao-da-demanda.md), seções 1 e 2.
**O que conferir:** as duas personas de síndico e as duas jornadas atuais descrevem como a coisa
realmente acontece? Falta alguma dor? Alguma está exagerada?
**Por que importa:** a **Persona 1B** (síndico profissional, de imobiliária) foi descrita **de fora** — e
é ela que sustenta os requisitos mais caros. Se alguém conhece um síndico profissional, uma conversa
curta com ele vale mais que qualquer revisão de documento.

### B · O vocabulário
**Onde:** [Glossário](glossario.md).
**O que conferir:** os termos são os que você usaria naturalmente? Algum soa artificial? A seção 7 lista
cinco colisões que resolvemos — as resoluções fazem sentido?
**Por que importa:** estes termos viram nome de tela, de tabela e de botão. Trocar agora é barato.

### C · As suposições
**Onde:** [Premissas e Questões Abertas](premissas-e-questoes-abertas.md).
**O que conferir:** as premissas (P1, P3, P4, P5) são apostas razoáveis? E os pontos de atenção ainda
abertos — algum deles você sabe responder?
**Por que importa:** é o documento que assume que podemos estar errados. Quanto mais coisa sair dele
com resposta, menor o risco.

### D · Os critérios de aceite
**Onde:** [Arquitetura](arquitetura.md), tópico 10.
**O que conferir:** os nove critérios (A1 a A9) são o suficiente para dizer "está pronto"? Falta algo
que você checaria?
**Por que importa:** vocês são quem vai verificar. Se o critério não estiver claro para vocês, não
serve.

---

## Como devolver a revisão

Três saídas possíveis para cada frente:

- **Está ok** — diga explicitamente, para a gente poder seguir.
- **Precisa mudar** — aponte o trecho e o que está errado. Pode ser comentário no arquivo aqui no
  GitHub, ou mensagem no grupo.
- **Precisa conversar** — se for algo que não se resolve por escrito, marcamos.

---

## Estado do trabalho

| | |
|---|---|
| **Decisões de produto registradas** | 27 |
| **Questões abertas** | 0 — todas as 14 foram fechadas |
| **Premissas assumidas sem validação** | 4 |
| **Pontos de atenção ainda abertos** | 15 |
| **Histórias na primeira entrega** | 36 |
| **Entrega** | 29/09/2026 |

**O que vem depois desta revisão:** implementação. A ordem já está definida — primeiro o pipeline de
deploy, o agregado com a trilha de auditoria e o isolamento entre organizações; depois as
funcionalidades, seguindo a jornada da esquerda para a direita.
