# Controles dos verificadores

## Verificador de Mermaid

**Nenhum dos dois arquivos deste diretório deve ser consertado.** Eles não são documentação: são o controle
do verificador, e a razão de existirem é que um `mermaid.parse()` que aceite tudo — por versão trocada, por
exceção engolida, por não estar sendo chamado — **passa exatamente como um repositório inteiro correto**.

O controle é **diferencial**, e é isso que o torna forte: dois diagramas que diferem em **um** par de aspas.

| Arquivo | O verificador exige | Por quê |
|---|---|---|
| `controle-negativo.mmd` | ser **recusado** | `A[Em análise (pelo Gestor)]` — parêntese dentro de rótulo de nó. O Mermaid lê `(` como abertura de forma e recusa |
| `controle-positivo.mmd` | ser **aceito** | o mesmo diagrama com o rótulo entre aspas, que é o conserto correto |

Se os dois passarem, o parser não está discriminando. Se os dois falharem, ele não está parseando o que
achamos que parseia. Nas duas situações o verificador falha o build — mesmo que todo diagrama de `docs/`
esteja certo.

**O erro é real e este projeto já o cometeu.** Ele aparece ao copiar `Em análise (pelo Gestor)` de um PDF
para um `flowchart`, que é literalmente como os `.mmd` de `refs/` nasceram. A falha é silenciosa: o GitHub
mostra o bloco de código cru, e ninguém percebe.

O diretório está fora da varredura do verificador (`comum.mjs`, lista `IGNORADOS`) para que os controles não
sejam contados como documento do repositório.

## Verificador de imagem

`imagem-insegura/` é uma imagem que **tem de ser recusada pelas quatro conferências**, e cada erro dela
existe para dar alvo a uma:

| O erro, no `Dockerfile` do controle | Conferência que ele obriga a disparar |
|---|---|
| `COPY segredo.env .env` seguido de `RUN rm .env` | **A** — o histórico. É a frase do DoD: o arquivo some do sistema final e **fica na camada** |
| `ENV SUPABASE_CHAVE_ANONIMA=sb_publishable_…` | **B** — o ambiente que a imagem carrega |
| `COPY segredo.env .env.producao`, que **fica** | **C** — o sistema de arquivos final |
| `/app/.next/static/pacote-de-mentira.js` com uma chave dentro | **D** — o que vai ao navegador |

**Não conserte nenhum dos quatro.** Se o verificador parar de recusar por uma delas, quem está quebrado é
o verificador: as conferências C e D rodam `find` e `grep` **dentro** do container, e uma opção que o
BusyBox não tenha devolve saída vazia — indistinguível de imagem limpa.

`segredo.env` não se chama `.env` de propósito: o `.gitignore` da raiz ignora `.env` e `.env.*`, e controle
que não existe num clone limpo não controla nada.
