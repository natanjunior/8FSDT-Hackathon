# ADR-0004 — Execução em container no Azure Container Apps, com registro no GitHub Container Registry

**Status:** Aceita · 20/08/2026 · **Substitui parcialmente a [ADR-0002](0002-stack-e-plataforma.md)**

## Contexto

A [ADR-0002](0002-stack-e-plataforma.md) escolheu Next.js na Vercel, com Supabase para banco,
autenticação e storage. Ela registrou, como consequência negativa explícita, que **o `Dockerfile` não é o
que roda em produção** — a Vercel executa funções, e o container serviria apenas ao desenvolvimento e ao
build. O enunciado exige **Docker** (E7) e **deploy em cloud** (E8) como entregáveis distintos.

Três informações novas mudaram o cálculo.

**A disciplina de DevOps da Fase 5 ensina exatamente este caminho.** São nove aulas: as quatro primeiras
sobre Azure DevOps, a quinta sobre Docker, e as quatro últimas sobre **Azure Container Registry**,
**Container Instances**, **Web App** e **Container Apps** — ou seja, publicar e executar um container em
nuvem. Nenhuma outra disciplina do curso ensinou isso: a Fase 2 ensinou construir a imagem e publicá-la
num registro, mas o pipeline de entrega daquele trabalho terminou em *placeholder*, com o deploy real não
implementado.

**O Azure Container Apps é gratuito na escala deste projeto.** A franquia mensal por assinatura é de
180.000 vCPU-segundos, 360.000 GiB-segundos e 2 milhões de requisições, com **escala a zero** — sem
cobrança enquanto não há requisição. O RNF3 pede 20 usuários simultâneos.

**Existe crédito Azure for Students de US$ 100**, válido até 20/08/2027 — depois da entrega. Ele deixou de
ser restrição e passou a ser reserva.

## Decisão

| Camada | Escolha |
|---|---|
| **Execução** | **Azure Container Apps** |
| **Registro de imagem** | **GitHub Container Registry (`ghcr.io`)**, imagem pública |
| **Storage de anexo** | **Azure Blob Storage** |

**Permanece da ADR-0002, sem alteração:** Next.js com TypeScript · PWA para leitura offline · route
handlers como APIs · **GitHub** para o código · **GitHub Actions** para CI/CD · **Supabase** para
PostgreSQL e autenticação.

A esteira passa a ser: **GitHub Actions constrói a imagem → publica no `ghcr.io` → Azure Container Apps
puxa e executa.** É o caminho documentado pela Microsoft, com a action `azure/container-apps-deploy-action`
— e imagem pública no `ghcr.io` é consumida **sem credencial**.

## Justificativa

**1. E7 deixa de ser divergência declarada.** O container que construímos passa a ser o que está no ar.
A consequência negativa registrada na ADR-0002 desaparece em vez de ser gerenciada.

**2. É o único caminho que alguma disciplina do curso ensinou para E8.** A Fase 2 parou na imagem. As
aulas 6 a 9 da Fase 5 cobrem o resto.

**3. O custo zero é preservado, e sem depender do crédito.** Container Apps cabe na franquia mensal
permanente; `ghcr.io` é gratuito para imagem pública; o Blob Storage custa cerca de **US$ 1 por ano** no
nosso volume. **O crédito de US$ 100 permanece praticamente intacto**, como reserva.

**4. O teto de storage desaparece.** O modelo de dados identificou que o gargalo do free tier não era o
banco (~55.000 ocorrências) e sim o storage do Supabase (~2.500). Com Blob Storage, esse limite deixa de
existir na escala do projeto.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **Manter a Vercel** | Continua defensável — a Vercel também é nuvem e satisfaz E8 literalmente. O que ela não satisfaz é *"o container que construí é o que roda"*, e o custo de resolver isso é cerca de um dia de trabalho. A troca foi feita porque converte uma fraqueza declarada em capacidade demonstrável |
| **ACR como registro** | **Recusado com crédito disponível para pagá-lo** — o que é o ponto. O ACR Basic custa ~US$ 0,167/dia, cerca de US$ 61 em doze meses, e **não compra nada técnico neste caso**: imagem privada é inútil num repositório acadêmico que será público, e a diferença de latência de pull é irrelevante no nosso volume. Somando: o `GITHUB_TOKEN` do Actions já autentica no `ghcr.io` sem segredo novo, enquanto o ACR exigiria um recurso e uma identidade a mais. Gastar 61% de um crédito finito no que o `ghcr.io` faz de graça seria gasto sem contrapartida |
| **Azure Container Instances · Azure Web App** (aulas 7 e 8) | Container Apps foi escolhida pela **franquia mensal gratuita documentada com escala a zero**, que é o que preserva o custo zero sem consumir crédito |
| **Azure Repos · Boards · Pipelines** (aulas 1 a 4) | O código e a esteira permanecem no GitHub. A escolha do GitHub Actions veio da **Fase 2**, que o ensinou e cuja entrega recebeu nota máxima — é alinhamento com o curso, não afastamento dele. O curso não é uma voz só, e onde duas disciplinas divergem, escolhemos a que já foi validada em entrega |
| **Mover PostgreSQL e autenticação para o Azure** | O modelo de dados já entregue está construído sobre `auth.users` do Supabase, e a autenticação é subdomínio genérico que decidimos comprar e não construir. Mover exigiria substituir o provedor de identidade e refazer parte do modelo, a 40 dias da entrega |

## Consequências

**Positivas**

- O `Dockerfile` roda em produção; E7 e E8 são satisfeitos pelo mesmo artefato.
- A cadeia de deploy corresponde ao que as aulas 5, 6 e 9 ensinaram, com uma substituição declarada.
- O limite de storage deixa de ser restrição de projeto.
- O crédito de estudante permanece disponível como reserva para imprevisto.
- **Ganho não previsto: portabilidade.** Enquanto a aplicação era função serverless, trocar de provedor de
  execução implicava revisar o modelo de execução — era o acoplamento mais caro do desenho. Como container,
  ela roda em qualquer lugar que execute containers. O provedor de execução deixou de ser a dependência
  difícil de desfazer e passou a ser a mais fácil.

**Negativas e custos assumidos**

- **Três provedores** — GitHub para código e esteira, Azure para execução e storage, Supabase para banco e
  autenticação. Cada um com razão própria, mas é uma superfície a mais de configuração e de falha.
- **Perde-se o *preview* por branch.** A Vercel gerava URL por branch automaticamente, e o plano de
  implantação a usava como ambiente de revisão funcional. O Container Apps tem revisões, mas *preview*
  automático por branch não é nativo: a revisão passa a acontecer num ambiente único.
- **A imagem é pública** — qualquer pessoa pode executar `docker pull`. Isso é aceitável porque o
  repositório será aberto na entrega, mas impõe uma regra: **nenhum segredo pode ser assado em tempo de
  build**. Segredo passado como `ARG`, ou `.env` copiado para a imagem, permanece nas camadas **mesmo que
  um `RUN rm` o apague depois**, e em imagem pública isso é leitura livre. Entra no Definition of Done.
  Em Next.js, variáveis `NEXT_PUBLIC_*` são embutidas no bundle por natureza e são públicas por desenho;
  as demais nunca podem ser.
- **Cold start com escala a zero.** Já estava declarado no RNF5 quando a plataforma era outra; muda a
  causa, não o fato.
- **Setup maior** — cerca de um dia: `Dockerfile` com saída *standalone* do Next.js, build e push no
  Actions, passo de deploy, e a dependência `sharp` no container para o `next/image`.

## Fontes

- **Aulas 5, 6 e 9 da disciplina de DevOps (Fase 5)** — Docker, Azure Container Registry e Azure
  Container Apps.
- [FONTE EXTERNA] [Azure Container Apps — preços e franquia mensal](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [FONTE EXTERNA] [Billing in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/billing)
- [FONTE EXTERNA] [Deploy to Azure Container Apps with GitHub Actions](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)
- [FONTE EXTERNA] [Azure Container Registry — preços](https://azure.microsoft.com/en-us/pricing/details/container-registry/)
- [FONTE EXTERNA] [Azure for Students](https://azure.microsoft.com/en-us/free/students)
