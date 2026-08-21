# Controles do verificador de Mermaid

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
