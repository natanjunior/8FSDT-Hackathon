---
title: "ADR-0004 · Execução em container no Azure"
description: "Azure Container Apps com registro no GitHub Container Registry, e a credencial federada no lugar do segredo de longa vida."
---

# ADR-0004 — Execução em container no Azure Container Apps, com registro no GitHub Container Registry

**Status:** Aceita · 20/08/2026 · Substitui parcialmente a [ADR-0002](0002-stack-e-plataforma.md)

## Contexto

A [ADR-0002](0002-stack-e-plataforma.md) escolheu Next.js na Vercel, com Supabase para banco,
autenticação e storage. Ela registrou, como consequência negativa explícita, que o `Dockerfile` não é o
que roda em produção: a Vercel executa funções, e o container serviria apenas ao desenvolvimento e ao
build. O enunciado exige conteinerização e deploy em cloud como entregáveis distintos.

Três informações novas mudaram o cálculo.

**Executar o próprio container satisfaz os dois requisitos com um artefato só.** Publicar uma imagem num
registro e executá-la em nuvem fecha conteinerização e deploy no mesmo caminho, em vez de tratar o
container como ferramenta de desenvolvimento e a nuvem como outra coisa.

**O Azure Container Apps é gratuito na escala deste projeto.** A franquia mensal por assinatura é de
180.000 vCPU-segundos, 360.000 GiB-segundos e 2 milhões de requisições, com escala a zero, sem cobrança
enquanto não há requisição. O RNF3 pede 20 usuários simultâneos.

**Existe crédito Azure for Students de US$ 100**, válido até 20/08/2027, depois da entrega. Ele deixou de
ser restrição e passou a ser reserva.

## Decisão

| Camada | Escolha |
|---|---|
| Execução | Azure Container Apps |
| Registro de imagem | GitHub Container Registry (`ghcr.io`), imagem pública |
| Storage de anexo | Azure Blob Storage |

Permanece da ADR-0002, sem alteração: Next.js com TypeScript, PWA para leitura offline, route handlers
como APIs, GitHub para o código, GitHub Actions para CI/CD, e Supabase para PostgreSQL e autenticação.

A esteira passa a ser: o GitHub Actions constrói a imagem, publica no `ghcr.io`, e o Azure Container Apps
puxa e executa. É o caminho documentado pela Microsoft, com a action
`azure/container-apps-deploy-action`, e imagem pública no `ghcr.io` é consumida sem credencial.

**A esteira autentica no Azure por credencial federada, e não por segredo de longa vida.** O emprego de
implantação não guarda senha de cliente: o GitHub emite um token curto por execução, e o Entra ID o
aceita porque confia naquele repositório e naquele *environment*. No lugar do segredo ficam três
identificadores públicos, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` e `AZURE_SUBSCRIPTION_ID`, guardados como
*Variables* e não como *Secrets*, porque não são credencial.

## Justificativa

**1. A divergência entre ambientes desaparece.** O container que construímos passa a ser o que está no
ar. A consequência negativa registrada na ADR-0002 some, em vez de ser gerenciada.

**2. O custo zero é preservado, e sem depender do crédito.** Container Apps cabe na franquia mensal
permanente; `ghcr.io` é gratuito para imagem pública; o Blob Storage custa cerca de US$ 1 por ano no
nosso volume. O crédito de US$ 100 permanece praticamente intacto, como reserva.

**3. O teto de storage desaparece.** O modelo de dados identificou que o gargalo do free tier não era o
banco, com cerca de 55.000 ocorrências, e sim o storage do Supabase, com cerca de 2.500. Com Blob
Storage, esse limite deixa de existir na escala do projeto.

**4. A credencial federada se amarra a repositório mais *environment*.** O `environment: producao` que o
emprego declara é a âncora, e nem outro ramo nem um *fork* obtêm o token. Uma senha de cliente não teria
limite nenhum: quem a tivesse usaria de qualquer lugar e por tempo indeterminado.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter a Vercel | Continua defensável, porque a Vercel também é nuvem e satisfaz o requisito de deploy literalmente. O que ela não satisfaz é a leitura de que o container construído é o que roda, e o custo de resolver isso é cerca de um dia de trabalho. A troca foi feita porque converte uma fraqueza declarada em capacidade demonstrável |
| ACR como registro | Recusado com crédito disponível para pagá-lo, o que é a parte interessante. O ACR Basic custa cerca de US$ 0,167 por dia, algo como US$ 61 em doze meses, e não compra nada técnico neste caso: imagem privada é inútil num repositório acadêmico que será público, e a diferença de latência de pull é irrelevante no nosso volume. Somando, o `GITHUB_TOKEN` do Actions já autentica no `ghcr.io` sem segredo novo, enquanto o ACR exigiria um recurso e uma identidade a mais |
| Azure Container Instances ou Azure Web App | Container Apps foi escolhida pela franquia mensal gratuita documentada com escala a zero, que é o que preserva o custo zero sem consumir crédito |
| Azure Repos e Azure Pipelines | O código e a esteira permanecem no GitHub. A escolha do GitHub Actions veio de uma entrega anterior do time que o usou com sucesso, então há precedente validado. O Azure Boards seguiu caminho oposto e foi adotado, pelo motivo abaixo |
| Mover PostgreSQL e autenticação para o Azure | O modelo de dados já entregue está construído sobre `auth.users` do Supabase, e a autenticação é subdomínio genérico que decidimos comprar em vez de construir. Mover exigiria substituir o provedor de identidade e refazer parte do modelo, a 40 dias da entrega |

**Sobre o Azure Boards, que foi adotado.** A primeira redação desta ADR recusou "Azure Repos, Boards e
Pipelines" numa linha só, com um argumento que só cobria dois deles: dizer que o código e a esteira
permanecem no GitHub responde por Repos e Pipelines, e não responde por Boards, que não é código nem
esteira. Separados, o critério fica mais preciso: adotamos a ferramenta nova onde não havia precedente
validado, e mantivemos a de fora onde havia. O GitHub Actions ficou porque uma entrega anterior do time
já o usou com resultado; o acompanhamento de trabalho não tinha precedente equivalente. O código, os
*pull requests* e o pipeline continuam integralmente no GitHub.

**Sobre a autenticação por senha de cliente, que funcionava.** Um *service principal* com
`AZURE_CREDENTIALS` deixava a esteira verde e não exigia mudar uma linha do workflow. Foi recusado por
dois motivos. O primeiro é a doutrina desta própria ADR aplicada ao outro lado: a regra da imagem pública
é que o que não existe não vaza, e nenhum segredo é assado em tempo de build; segredo de longa vida nas
configurações do repositório é a mesma categoria de risco em outro lugar. O segundo é que
`az ad sp create-for-rbac --sdk-auth` está depreciado, com aviso da própria CLI, e construir sobre uma
bandeira já anunciada como saída para economizar dez linhas é a troca errada num trabalho avaliado por
arquitetura.

## Consequências

**Positivas**

- O `Dockerfile` roda em produção, e conteinerização e deploy em cloud são satisfeitos pelo mesmo
  artefato.
- O limite de storage deixa de ser restrição de projeto.
- O crédito de estudante permanece disponível como reserva para imprevisto.
- **Ganho não previsto: portabilidade.** Enquanto a aplicação era função serverless, trocar de provedor
  de execução implicava revisar o modelo de execução, e esse era o acoplamento mais caro do desenho. Como
  container, ela roda em qualquer lugar que execute containers. O provedor de execução deixou de ser a
  dependência difícil de desfazer e passou a ser a mais fácil.

**Negativas e custos assumidos**

- **Três provedores:** GitHub para código e esteira, Azure para execução e storage, Supabase para banco e
  autenticação. Cada um com razão própria, e é uma superfície a mais de configuração e de falha.
- **Perde-se o *preview* por branch.** A Vercel gerava URL por branch automaticamente, e o plano de
  implantação a usava como ambiente de revisão funcional. O Container Apps tem revisões, mas *preview*
  automático por branch não é nativo, então a revisão passa a acontecer num ambiente único.
- **A imagem é pública**, e qualquer pessoa pode executar `docker pull`. A visibilidade do pacote no
  `ghcr.io` é independente da do repositório: o pacote nasce privado mesmo em repositório público, e teve
  de ser tornado público explicitamente. Hoje o pacote é público e o repositório continua privado. Isso é
  aceitável, e impõe uma regra: nenhum segredo pode ser assado em tempo de build. Segredo passado como
  `ARG`, ou `.env` copiado para a imagem, permanece nas camadas mesmo que um `RUN rm` o apague depois, e
  em imagem pública isso é leitura livre. Entra no Definition of Done. Em Next.js, variáveis
  `NEXT_PUBLIC_*` são embutidas no bundle por natureza e são públicas por desenho; as demais nunca podem
  ser.
- **Cold start com escala a zero.** Já estava declarado no RNF5 quando a plataforma era outra; muda a
  causa, e não o fato. Medido em 20,7 s.
- **Setup maior**, de cerca de um dia: `Dockerfile` com saída *standalone* do Next.js, build e push no
  Actions, passo de deploy, e a dependência `sharp` no container para o `next/image`.
- **Uma dependência a mais do formato de `subject` que o GitHub emite** para a credencial federada. Custou
  uma execução vermelha, e está registrada na §9 da [`arquitetura.md`](../arquitetura.md).

## O que deu errado no caminho, e vale ficar escrito

**A decisão pelo OIDC foi tomada antes e não atravessou.** Ela foi fechada ao responder uma pergunta de
especificação, e nunca chegou à conversa que provisionou a nuvem. O ambiente foi criado com senha de
cliente, a esteira ficou verde, e só depois a decisão foi reencontrada. Durante esse intervalo o projeto
teve o seu único segredo de longa vida, por acidente de sequência. O modo de falha não foi técnico: foi
uma decisão certa que não atravessou de uma conversa para outra.

**O `subject` da credencial foi conferido do jeito errado.** Ele foi escrito a partir do exemplo da
documentação e conferido listando a credencial e comparando com o que se havia escrito, o que confirma a
própria digitação e não prova nada. O `subject` se descobre lendo o log de uma execução real. É a mesma
classe de defeito que este pacote já cometeu mais de uma vez: conferir o artefato contra a lista que o
produziu.

## Fontes

- [Azure Container Apps, preços e franquia mensal](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [Billing in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/billing)
- [Deploy to Azure Container Apps with GitHub Actions](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)
- [Azure Container Registry, preços](https://azure.microsoft.com/en-us/pricing/details/container-registry/)
- [Azure for Students](https://azure.microsoft.com/en-us/free/students)
