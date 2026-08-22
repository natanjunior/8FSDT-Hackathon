# =============================================================================
#  CONTROLE NEGATIVO — esta imagem TEM de ser recusada
# =============================================================================
#
#  Ela comete de propósito os três erros que o verificador existe para pegar,
#  e o terceiro é o que dá nome à regra: o `RUN rm` apaga o arquivo do sistema
#  final e **a camada continua tendo o arquivo**. Um verificador que só olhasse
#  o sistema de arquivos final diria que esta imagem está limpa.
#
#  `node:24-alpine` e não `alpine`: é a mesma base do Dockerfile do projeto,
#  então já está na máquina e no cache do pipeline — o controle não custa um
#  download.
# =============================================================================

FROM node:24-alpine

ARG SEGREDO_DE_SESSAO=nao-devia-existir-um-ARG-aqui
ENV SUPABASE_CHAVE_ANONIMA=sb_publishable_isto_e_um_controle

WORKDIR /app

# Alvo da conferência A · copiado e apagado depois. O sistema de arquivos final
# não o mostra; a camada, sim. É a frase do DoD virada em pedra.
COPY segredo.env .env
RUN rm .env

# Alvo da conferência C · este fica. Sem ele, a conferência que olha o sistema
# de arquivos final não teria contra o que disparar — e uma conferência que
# nunca dispara é indistinguível de uma que está quebrada.
COPY segredo.env .env.producao

# Alvo da conferência D · um pedaço de "pacote do navegador" com chave dentro.
RUN mkdir -p /app/.next/static \
 && printf 'const chave="sb_publishable_isto_e_um_controle";\n' > /app/.next/static/pacote-de-mentira.js
