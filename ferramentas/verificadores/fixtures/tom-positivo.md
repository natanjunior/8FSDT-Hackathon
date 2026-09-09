# Controle positivo do verificador de tom

Este arquivo diz o mesmo que o controle negativo e passa nas seis regras. Existe para provar que o
verificador não recusa tudo: se ele reprovar este arquivo, está reprovando por peso de texto, e não por
sinal de tom.

A auditabilidade é uma invariante do agregado, garantida por consistência forçada: nenhum código de fora
escreve o status, e a única porta são os comandos que gravam o histórico na mesma operação.

O esquema tem catorze tabelas.
