# Arquitetura da Solução — Resolve Aí

Este documento tem duas partes. A **Parte I** é o design estratégico de DDD (aulas 1 a 6): subdomínios,
contextos delimitados, mapa de contexto e o agregado central. A **Parte II** segue o **Documento de
Requisito Técnico da Solução** da aula 8 (p.7–9), nos seus dez tópicos, com os títulos do professor.

> ⚠️ **Pré-requisito do template, e por que divergimos dele.** O professor introduz o template dizendo:
> *"**com as Provas de Conceito (POCs) realizadas e a Arquitetura da solução já desenhada**, o
> preenchimento do requisito técnico é realizado..."* (p.7–8). A arquitetura está desenhada; **a POC não
> foi feita, e foi uma decisão consciente.**
>
> O motivo: o que uma POC de deploy exigiria — criar o projeto, conectar o banco, escrever a primeira
> migração, montar o `Dockerfile`, publicar — **é o esqueleto do projeto, não trabalho descartável**.
> Seria feito de qualquer forma no primeiro dia de implementação. E o instrumento existe para reduzir
> incerteza técnica, que aqui é baixa: a stack escolhida já foi usada pelo implementador em outro
> projeto entregue. Aplicá-lo com força seria correto se a escolha fosse, por exemplo, Java em free tier.
>
> **O que fica no lugar:** o pipeline de deploy é a **primeira tarefa de implementação**, antes de
> qualquer código de domínio — para que "está publicado" seja verdade desde o primeiro commit. Os pontos
> marcados **`⟨a medir no primeiro deploy⟩`** são metas declaradas que se fecham ali, sem exercício
> dedicado.

---

# Parte I — Design Estratégico

## 1. Subdomínios

Taxonomia da aula 1 (Principal, Genérico e de Suporte). A classificação diz **onde gastar as poucas
horas de modelagem**.

| Subdomínio | Tipo | Por quê |
|---|---|---|
| **Ciclo de vida da ocorrência e auditoria das transições** | **Principal** | É o que o enunciado destaca (*"cada transição de status deve ser auditável"*) e o que diferencia o produto do grupo de WhatsApp. Todo o esforço de modelagem vai aqui |
| **Autenticação** | **Genérico** | Problema resolvido, sem diferencial competitivo. Comprado de terceiro (Supabase Auth) |
| **Organização, pessoas e vínculos** · **categorias e áreas** · **notificação** | **Suporte** | Necessários para o Principal funcionar, sem valor próprio. Implementação simples e direta |

## 2. Contextos delimitados

O curso é explícito em que contexto e subdomínio **não são a mesma coisa** — são *"limites que **não**
são definidos pelos subdomínios"* (aula 3, p.8). Nosso de-para é **3 subdomínios → 2 contextos**:

| Contexto | Agregados | Subdomínios que abriga |
|---|---|---|
| **① Ocorrências** | `Ocorrência` · `Canal de conversa` · `Notificação` | Principal + parte do Suporte |
| **② Organização e Acesso** | `Organização` · `Pessoa` · `Usuário` | Suporte + Genérico |

**Por que dois e não seis.** A aula 3 (p.9) autoriza: *"podem existir casos de contextos delimitados que
englobem a solução inteira — **se a solução for muito pequena isso é possível**"*. Somado à regra de que
um contexto é sempre trabalhado por **um time**, e havendo **um implementador**, fatiar mais seria
arquitetura de enfeite. A fronteira entre ① e ② coincide com o evento pivotal `Ocorrência registrada`,
identificado no passo 4 do Event Storming — o professor descreve eventos pivotais como *"importantes
indicadores de contextos delimitados"* (aula 6, p.8), e foi o que se confirmou.

**`Notificação` fica em ① mas é o candidato natural a extração** se o produto crescer: hoje todos os seus
gatilhos são eventos de ocorrência, mas ela não tem nada de específico do domínio.

## 3. Mapa de contexto e padrões de integração

```mermaid
flowchart LR
    subgraph C1["① Contexto de Ocorrências — Principal"]
        OC["Ocorrência"]
        CV["Canal de conversa"]
        NT["Notificação"]
    end

    subgraph C2["② Organização e Acesso — Suporte"]
        OR["Organização"]
        PE["Pessoa"]
        US["Usuário"]
    end

    AUTH["🔒 Provedor de autenticação<br/>(Supabase Auth)<br/>SISTEMA EXTERNO"]
    CANAIS["📤 E-mail · Push · WhatsApp<br/>SISTEMA EXTERNO<br/>(plano pago)"]
    CARGA["📥 Planilha / sistema da<br/>administradora<br/>SISTEMA EXTERNO"]

    C2 -->|"vínculo e escopo"| C1
    AUTH -->|"Conformista + ACL"| US
    NT -->|"Caminhos Separados<br/>no plano gratuito"| CANAIS
    CARGA -->|"importação"| PE
```

Dos nove padrões que a aula 4 ensina, **usamos três** — e nomear os outros seis seria vocabulário sem
função:

**Conformista** — para o provedor de autenticação. O exemplo do professor é literalmente OAuth 2.0:
*"não temos como negociar para que ele se adeque às nossas necessidades... temos que nos conformar"*
(aula 4, p.9). Com custo zero, usamos auth de terceiro; nomear a decisão com o termo do curso é preciso
e barato.

**Anticorruption Layer (ACL)** — entre o provedor e o núcleo. O caso 1 da lista do professor (p.12) é
*"quando o contexto Cliente contém um subdomínio principal — isso evita que se corrompa ou interfira na
implementação da solução principal"*. Traduz-se numa regra de fronteira concreta e testável: **o agregado
`Ocorrência` não conhece formato de token nem claim**. A tradução acontece no ponto único que resolve o
contexto da requisição (ADR-0003).

**Caminhos Separados** — para justificar o que **não** integramos. O professor cita "Sistemas de
Autenticação" e "Sistemas de Log" como casos típicos (p.15). Aqui: no plano gratuito, a notificação
**não sai** do sistema; e não há integração com monitoramento externo.

> **Kernel Compartilhado descartado com a fonte:** o próprio professor o desencoraja — *"esse tipo de
> modelo é desencorajado... teoricamente viola todo o princípio dos contextos delimitados"* (aula 4,
> p.6–7). É a justificativa para **não** criar uma "lib comum" entre os dois contextos.

## 4. O agregado `Ocorrência`

O mecanismo central da solução, decidido na [ADR-0001](adr/0001-historico-de-transicoes-como-conceito-de-dominio.md).
A premissa é a **consistência forçada** (aula 5, p.9): *"somente a lógica do agregado pode alterar o seu
estado"*.

**Dentro do limite:**

| Elemento | Natureza |
|---|---|
| `Ocorrência` | Entidade raiz |
| `HistoricoTransicao` | **Objeto de valor imutável** — a imutabilidade *é* o requisito de auditoria |
| `Localizacao` | Objeto de valor (referência a uma `Área` + complemento em texto) |
| `Avaliacao` | Objeto de valor, opcional, preenchido após `Resolvida` |
| `Adesões` | Lista de pessoas que aderiram |
| Referência à ocorrência original, quando cancelada por duplicidade | Identificador |

**Fora do limite, referenciados por id:** `Canal de conversa` · `Notificação` · `Pessoa` ·
`Organização` · `Área` · `Categoria`.

**Por que `Canal` fica fora:** mensagem é evento de alto volume e carregaria o agregado inteiro a cada
envio; e **nenhuma invariante transacional atravessa os dois** — a regra "o canal da atribuição existe
enquanto a atribuição existe" é garantida por política, não por transação.

### Tabela de transições permitidas

Nenhuma outra transição existe. Comandos que **não** transicionam estão listados abaixo da tabela.

| De | Comando | Para | Quem pode |
|---|---|---|---|
| — | `registrar` | `Aberta` | Solicitante |
| `Aberta` | `analisar` | `Em análise` | Gestor |
| `Aberta` | `cancelar` | `Cancelada` | Solicitante autor · Gestor |
| `Em análise` | `iniciarAtendimento` | `Em atendimento` | Gestor |
| `Em análise` | `pausar` | `Pausada` | Gestor |
| `Em análise` | `cancelar` | `Cancelada` | Solicitante autor · Gestor |
| `Em atendimento` | `resolver` | `Resolvida` | **Gestor apenas** |
| `Em atendimento` | `pausar` | `Pausada` | Gestor · responsável atribuído |
| `Em atendimento` | `cancelar` | `Cancelada` | **Gestor apenas** (D12) |
| `Pausada` | `retomar` | **o `status anterior` do registro de pausa** | Gestor |
| `Pausada` | `cancelar` | `Cancelada` | Gestor |

**`Resolvida` e `Cancelada` são terminais de verdade — não existe `reabrir`** (D24). Problema que volta é
**nova ocorrência vinculada à original**, reusando o vínculo que a D17 criou para duplicidade. Isso
preserva a D6, que congela a prioridade em estado terminal para o dashboard ser reproduzível, e o sinal
não se perde: "voltou a acontecer" é **recorrência**, o indicador central da D19.

**Comandos que não transicionam:** `alterarPrioridade` · `atribuirResponsavel` · `reatribuir` ·
`recusarAtribuicao` · `reportarExecucaoConcluida` · `registrarSolucaoAplicada` · `avaliar` · `aderir`.

### Invariantes do agregado

1. `status` **nunca** é escrito de fora — a única porta são os comandos acima.
2. Toda transição produz **exatamente um** `HistoricoTransicao`, na mesma operação. Não existe transição
   sem registro nem registro sem transição.
3. O histórico é **append-only**. Registro de auditoria que pode ser editado não é auditoria.
4. A criação gera o primeiro registro, com `status anterior` nulo (**premissa P1**).
5. `pausar` e `cancelar` exigem **motivo estruturado**, e a `observação` é **obrigatória** neles; nas
   demais transições ela é **opcional** (D23). O princípio: exigir texto onde há decisão a justificar, não
   onde é avanço rotineiro — campo obrigatório em momento rotineiro é preenchido com "ok" e o dado morre.
6. `retomar` usa o `status anterior` do registro de pausa como alvo — **não há campo extra para isso**.
7. `prioridade` é imutável em `Resolvida` e `Cancelada` (D6), para que o dashboard seja reproduzível.
8. `avaliar` só é aceito em `Resolvida`, e só do Solicitante autor.
9. **`iniciarAtendimento` exige responsável atribuído** (D21), com auto-atribuição em um clique — "quem
   está fazendo" é exatamente o que o Gestor não sabe hoje.
10. **`resolver` não exige solução aplicada por regra do sistema** (D22): ela é induzida por UX, com um
    interruptor por organização para quem precisar exigir.

## 5. As quatro camadas e a regra de dependência

Camadas da aula 5 (p.5–7), adotadas como **organização e regra de dependência** — não como discussão
arquitetural. O professor autoriza simplificar: *"em algumas arquiteturas, essa camada [Aplicação] não
existe, ela é integrada à camada de interface de usuário"* (p.5).

| Camada | O que pode | O que **não** pode |
|---|---|---|
| **Interface** (route handlers, telas) | Traduzir HTTP, validar formato | Conter regra de negócio; **tocar o banco** |
| **Aplicação** | Resolver o contexto da requisição, orquestrar, transacionar | Conter regra de negócio |
| **Domínio** | Todas as regras, incluindo a máquina de estados | **Persistir**; conhecer HTTP, token ou SQL |
| **Infraestrutura** | Persistência, storage, envio externo | Decidir regra |

**Esta é a regra que protege a ADR-0001.** Se o Domínio não persiste e a Aplicação não tem regra, a
lógica de transição não pode vazar para o handler nem para o repositório — que é exatamente onde ela vaza
sob pressão de prazo. **Garantida por regra de lint**, não por disciplina: nada fora da Infraestrutura
importa o cliente de banco.

---

# Parte II — Documento de Requisito Técnico da Solução

## 1. Descrição Detalhada da Solução

Aplicação **Next.js** única, em TypeScript, empacotada em **container** e executada no **Azure Container
Apps**, com **Supabase** para PostgreSQL e autenticação, **Azure Blob Storage** para os anexos, e **PWA**
para leitura offline. Internamente organizada em quatro camadas (Parte I, §5) e dois contextos
delimitados (Parte I, §2), com o agregado `Ocorrência` (§4) como centro.

**O container que é construído é o que roda em produção** — ver
[ADR-0004](adr/0004-execucao-em-container-no-azure.md), que substituiu parcialmente a escolha original de
plataforma justamente para eliminar a divergência entre o `Dockerfile` e o ambiente publicado.

O fluxo de uma operação, de ponta a ponta: o cliente chama um **route handler**; a **camada de aplicação**
resolve o contexto da requisição — usuário, pessoa, organização, papel — num **ponto único**
([ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md)); carrega o agregado por um
**repositório já escopado** à organização; executa um **comando de domínio**, que valida a transição e
emite o registro de histórico na mesma operação; persiste; e as **políticas** in-process reagem ao evento,
criando notificação ou abrindo canal — **sem nunca escrever no agregado**.

### A arquitetura de referência da aula 8 como checklist de decisão

O professor apresenta nove componentes, com o condicional *"a arquitetura da solução **poderia** ficar
como"* (p.6) — é exemplo, não prescrição. Registramos componente a componente:

| # | Componente | Entra? | Por quê |
|---|---|---|---|
| 1 | Front-end | **Sim** | Next.js/React. Comunicação com o backend por APIs REST próprias |
| 2 | Back-end | **Sim** | Route handlers Next.js + camadas de aplicação e domínio |
| 3 | Banco de dados | **Sim** | PostgreSQL (Supabase). Relacional, porque o domínio é relacional e a auditoria exige integridade |
| 4 | Serviços de autenticação | **Sim** | Supabase Auth, integrado como **Conformista + ACL** |
| 5 | API Gateway | **Não** | Um único serviço, um único ponto de entrada. Gateway existe para rotear entre serviços |
| 6 | Microsserviços em cloud | **Cloud sim, microsserviços não** | O serviço roda em nuvem, num container no Azure Container Apps. **Microsserviços não**: são dois contextos e um implementador, e a aula 3 autoriza poucos contextos em solução pequena |
| 7 | Filas e mensageria | **Não** | Nenhuma operação assíncrona pesada no MVP. As dez políticas são in-process |
| 8 | Monitoramento e log | **Parcial** | Logs do Container Apps e do banco (Supabase). Sem ELK nem Prometheus — **Caminhos Separados** |
| 9 | Segurança | **Sim** | Tópico 5 |

## 2. Tecnologias e Ferramentas Utilizadas

Decisão e alternativas rejeitadas em [ADR-0002](adr/0002-stack-e-plataforma.md). Cada escolha justificada
contra um requisito, como o tópico pede:

| Tecnologia | Justificativa — contra qual requisito |
|---|---|
| **Next.js + TypeScript** | Deploy único, sem CORS nem tipos duplicados. Um implementador em ~6 semanas (risco técnico, o mais alto na análise de Cagan) |
| **PWA / service worker** | **RNF7** (leitura offline para o Encarregado) sem app nativo; ajuda o **RNF6** em rede ruim |
| **Route handlers próprios** | **E3** (APIs como entregável) e o consumo pelo PWA |
| **PostgreSQL** | **RNF2** (auditabilidade) exige integridade transacional entre a transição e o registro |
| **Supabase Auth** | Subdomínio **Genérico** — comprado, não construído. Prazo |
| **Azure Blob Storage** | **RNF8**. Remove o teto de arquivo que o free tier anterior impunha, por cerca de US$ 1 ao ano no nosso volume |
| **Azure Container Apps** | **E8** e **custo zero**: franquia mensal permanente com escala a zero. E é o que faz o **E7** deixar de ser apenas ambiente local |
| **`ghcr.io`** | Registro da imagem. Gratuito para imagem pública, e o `GITHUB_TOKEN` do Actions já autentica — sem recurso nem segredo novo. ACR foi considerado e recusado (ADR-0004) |
| **Docker + Supabase CLI** | **E7**, literal no enunciado. Ambiente local completo, incluindo a aplicação em container — e **o mesmo `Dockerfile` que vai para produção** |
| **Vitest** | **RNF2** e a máquina de estados testáveis **sem banco**, em milissegundos |
| **Playwright** | Caminho crítico de ponta a ponta; e verificação do **RNF1** por fora |
| **ESLint com regra de fronteira** | Torna mecânica a regra de dependência (Parte I, §5) e o ponto único da ADR-0003 |

## 3. Integrações e Dependências

Levantadas no passo 8 do Event Storming.

| Sistema externo | Direção | Como é gerenciada |
|---|---|---|
| **Supabase Auth** | entra | **Conformista**: aceitamos o contrato dele. **ACL** no ponto de resolução de contexto traduz sessão em `{usuário, pessoa, organização, papel}`. O domínio nunca vê token |
| **Azure Blob Storage** | sai/entra | Upload por URL assinada emitida pelo servidor. Nunca do cliente direto |
| **`ghcr.io`** | sai | O GitHub Actions publica a imagem; o Container Apps a consome. Imagem pública, sem credencial de leitura |
| **E-mail · Push · WhatsApp** | sai | **Fora do MVP.** POL-07 é o único ponto que consulta o plano; a entrega é plugável por trás dela. A API do WhatsApp é **cobrada por mensagem** — é o canal que mais pressiona o modelo comercial da D13 |
| **Fonte da carga de pessoas** | entra | Importação de arquivo, validada e transformada na camada de aplicação. Persona 1A traz planilha; 1B, o sistema da administradora |
| **Meio de pagamento** | sai | Fora do MVP. Decorre da D13 |

**Dependência de plataforma, declarada:** a solução depende de **três provedores** — GitHub para código e
esteira, Azure para execução e storage, Supabase para banco e autenticação. É uma superfície de
configuração maior que a de um provedor único, e cada peça tem razão própria registrada na
[ADR-0004](adr/0004-execucao-em-container-no-azure.md).

O acoplamento está concentrado na camada de Infraestrutura e no ACL de autenticação: trocar de provedor de
banco, de storage ou de auth é trabalho localizado. **Trocar o provedor de execução deixou de ser caro** —
a aplicação é um container, e container roda em qualquer lugar. Foi um dos ganhos da ADR-0004: a
portabilidade que o modelo serverless anterior não tinha.

## 4. Estratégias de Implementação e Desenvolvimento

> **Tópico deliberadamente não desenvolvido.** O template da aula 8 pede aqui a metodologia de
> desenvolvimento e as práticas de equipe. Entendemos que **arquitetura de software existe e se sustenta
> independentemente do processo que a implementa** — metodologia, cerimônias e organização de trabalho
> não pertencem à descrição da solução. A numeração original do template é preservada para que a
> correspondência com ele permaneça verificável.
>
> O que este tópico teria de conteúdo **técnico** está nos tópicos onde ele de fato pertence: a
> integração contínua e o bloqueio de merge por falha de teste estão no **tópico 7**; ambientes, rollout
> e rollback estão no **tópico 9**; e a ausência de revisão de código por pares — consequência de haver
> um único implementador — está declarada no Definition of Done.

## 5. Segurança e Conformidade

**Isolamento entre organizações** — o risco número um do produto, porque multi-tenancy é a adição `NOSSO`
mais cara. Mecanismo em [ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md): escopo
aplicado num **ponto único** na camada de aplicação; **RLS** ligada com outra responsabilidade — negar
acesso direto do cliente ao banco, forçando todo tráfego pelo servidor.

**Autorização orientada a permissão, não a papel.** As checagens perguntam `vinculo.pode(X)`, não
`vinculo.papel == GESTOR`. O mapa papel→permissões é constante em código; não há RBAC configurável no
MVP. A migração para permissões em banco, se um dia necessária, **não toca nenhum ponto de checagem**.

**Autenticação** delegada (subdomínio Genérico), com **ACL** impedindo que formato de token vaze para o
domínio.

**Dados pessoais e LGPD** (RNF10) — o produto guarda **foto e localização** de pessoas. Acesso restrito à
organização do vínculo; exclusão de conta **preserva a trilha de auditoria com o autor anonimizado**,
porque apagar o histórico destruiria o requisito central do enunciado. Ocorrência em unidade privativa é
visível apenas ao autor e aos Gestores (D10).

**Segredos** em variáveis de ambiente, nunca no repositório; `.env*` no `.gitignore`. Upload sempre por
URL assinada emitida pelo servidor.

**Fora de escopo, declarado:** pentest, WAF, criptografia em nível de coluna, auditoria de acesso de
leitura.

## 6. Escalabilidade e Manutenibilidade

**Não foi projetada para escalar — foi projetada para mudar.** É uma escolha, e o número justifica: o
**RNF3** pede 50 organizações e 2.000 ocorrências. Qualquer stack atende isso com folga, então otimizar
para escala seria otimizar para um problema que não temos.

O que **está** projetado para mudar:

- **Dois contextos com fronteira nomeada** — `Notificação` pode ser extraída sem tocar o domínio.
- **Ponto único de isolamento** — um lugar para mudar se o modelo de tenancy evoluir (por exemplo, se
  voltar a hierarquia acima da organização, rejeitada na D3).
- **Entrega de notificação plugável** — POL-07 é o único ponto que consulta o plano comercial.
- **Auditoria como conceito de domínio** — o registro de transição já tem formato de evento, o que mantém
  o caminho para event sourcing aberto por custo quase zero.
- **Permissão como conceito** — RBAC configurável entra trocando a fonte do mapa, sem mexer nas checagens.

**Teto conhecido: o banco.** São 500 MB no free tier do Supabase, o que comporta cerca de **55.000
ocorrências** — quase trinta vezes o alvo declarado no RNF3. **O storage deixou de ser restrição** com a
[ADR-0004](adr/0004-execucao-em-container-no-azure.md): no Azure Blob, o limite prático na nossa escala é
o custo, e o custo é da ordem de **US$ 1 por ano**.

Vale registrar o que essa troca resolveu: enquanto o arquivo vivia no free tier anterior, o gargalo era o
storage, e ele apertava cerca de vinte vezes antes do banco. A restrição que ditava o número do RNF3 era
essa — e ela não existe mais.

**⟨a medir no primeiro deploy⟩** Cold start com escala a zero, e p95 reais.

## 7. Testes

Plano organizado pelo que cada tipo **protege**, e não por meta de cobertura.

| Tipo | O que protege | Ferramenta | Sem banco? |
|---|---|---|---|
| **Unitário de domínio** | A máquina de estados e a invariante de auditoria: toda transição gera exatamente um registro; transição ilegal é rejeitada; `retomar` volta ao `status anterior` | Vitest | **Sim** |
| **Unitário de aplicação** | Autorização por comando: quem pode cancelar em cada estado (D12), quem pode resolver | Vitest | Sim (repositório em memória) |
| **Integração de repositório** | **O ponto único de isolamento (RNF1)**: consulta em nome da organização A **nunca** retorna dado de B | Vitest + Postgres do Supabase CLI | Não |
| **Ponta a ponta** | Caminho crítico: registrar → analisar → atribuir → atender → resolver → avaliar, com histórico conferido na interface | Playwright | Não |
| **Verificação de fronteira** | A regra de dependência (Parte I, §5): nada fora da Infraestrutura importa o cliente de banco | ESLint | — |

**Integração ao ciclo de vida:** o pipeline roda em todo push e **falha bloqueia merge**. E o
Definition of Done exige, por funcionalidade, *teste do caminho feliz **e de ao menos uma transição
inválida***, mais *transição gerando histórico, verificado em teste*. É a **defesa processual** da
auditabilidade, complementar à defesa estrutural do agregado.

**Fora de escopo, declarado:** teste de desempenho e de segurança automatizados. O RNF4 e o RNF5 são
verificados manualmente no primeiro deploy.

## 8. Documentação

| Documento | Onde | Público |
|---|---|---|
| Este documento | `docs/arquitetura.md` | Banca, e o próprio implementador |
| Glossário da linguagem ubíqua | `docs/glossario.md` | Todo o grupo — é o contrato de vocabulário |
| Documentação da Demanda | `docs/documentacao-da-demanda.md` | Banca |
| Registros de decisão (ADR) | `docs/adr/` | Banca, e quem mantiver o código depois |
| Definition of Done e Definition of Ready | `docs/definition-of-done.md` | O grupo |
| Premissas e questões abertas | `docs/premissas-e-questoes-abertas.md` | Banca |
| Event Storming curado | `docs/event-storming.md` | Banca |
| README com como rodar local | raiz | Quem clonar |
| Contrato das APIs | gerado dos route handlers | Consumidor da API |

**Diretriz de operação e manutenção:** o README cobre subir o ambiente local em Docker, rodar migrações e
executar os testes. O plano de implantação está no tópico 9.

**A estrutura de `docs/` no próprio repositório**, em vez de wiki externa, veio da aula 3 (p.7–8), que
lista "link para o repositório GitHub com código e documentação". Wiki externa vira artefato órfão depois
da entrega.

## 9. Plano de Implantação

| Ambiente | Onde | Para quê |
|---|---|---|
| **Local** | Docker: aplicação + Supabase CLI (Postgres, Auth, Storage) | Desenvolvimento e testes de integração |
| **Produção** | Azure Container Apps + projeto Supabase + Azure Blob Storage | Revisão funcional, demonstração e entrega |

**A cadeia de entrega:** merge em `main` → GitHub Actions constrói a imagem → publica no `ghcr.io` →
Container Apps cria uma **revisão** nova e passa a servir por ela.

**Rollback:** o Container Apps mantém revisões anteriores e permite redirecionar o tráfego para uma delas
— imediato, sem rebuild. **Migrações de banco** são versionadas em arquivo e aplicadas pelo CLI do
Supabase; **migração não é reversível automaticamente**, então mudança destrutiva de esquema exige script
de volta escrito à mão. Como o rollback da aplicação é instantâneo e o do banco não é, **a ordem segura é
migração compatível primeiro, código depois**.

> **O que se perdeu na troca de plataforma, declarado.** Não há mais **ambiente de preview por branch** —
> a plataforma anterior gerava URL por branch automaticamente, e o Container Apps não faz isso de forma
> nativa. **A revisão funcional passa a acontecer no ambiente único**, com o que isso implica: código não
> validado chega ao mesmo lugar que a demonstração. A mitigação é o portão do Definition of Done, não a
> infraestrutura.

**Ambiente de desenvolvimento e produção rodam o mesmo `Dockerfile`.** É o que faz E7 e E8 serem
satisfeitos pelo mesmo artefato, e foi a razão da [ADR-0004](adr/0004-execucao-em-container-no-azure.md).

**Risco de calendário:** o projeto Supabase free **pausa após 7 dias de inatividade**. Se houver
demonstração ao vivo, o banco precisa ser acordado antes. Mitigação: cron semanal no GitHub Actions.

## 10. Critérios de Aceitação e Validação

**Critérios de solução** — o que precisa ser verdade para a solução estar completa:

| # | Critério | Como é validado |
|---|---|---|
| A1 | Os 5 status e as transições da tabela da Parte I, §4 — e **nenhuma outra** | Teste unitário de domínio, incluindo transições ilegais |
| A2 | **100% das transições** com os 5 campos do histórico | Teste unitário + inspeção na interface (E2E) |
| A3 | Histórico **imutável**: não existe caminho de escrita que o altere | Revisão da API do agregado + ausência de operação de update no repositório |
| A4 | **Nenhum dado atravessa organizações** | Teste de integração no repositório escopado, com **duas organizações semeadas e a mesma Pessoa vinculada às duas** — o cenário da Persona 1B. Seed com pessoas distintas por organização **não detecta** o erro, porque o vazamento aparece justamente quando a Pessoa é global e a consulta parte dela |
| A5 | Solicitante e Gestor cumprem todas as capacidades do enunciado (S1–S10, G1–G8) | E2E do caminho crítico + revisão funcional contra o inventário de requisitos |
| A6 | Sobe com `docker compose` local, do zero | Executado em outra máquina, por quem não implementou |
| A7 | Publicado em cloud, acessível por URL | ⟨a medir no primeiro deploy — que é a primeira tarefa de implementação⟩ |
| A8 | Registro de ocorrência pelo celular em **menos de 1 minuto** (RNF6) | Cronometrado em rede móvel, por três pessoas distintas |
| A9 | Lista de atribuições do Encarregado abre **sem rede** (RNF7) | Verificado com o modo offline do navegador |

**Validação de produto** — os objetivos O1 a O6 da Documentação da Demanda. Com a ressalva já declarada
lá: **não há linha de base**, porque a jornada atual não mede nada. O6 (auditabilidade em 100%) é o único
que não é meta e sim consequência estrutural do desenho — e é validado por A2 e A3.

**Definition of Done** por funcionalidade em `docs/definition-of-done.md`; é ele que impede que testes,
Docker, deploy e documentação fiquem para a última semana.
