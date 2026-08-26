#!/usr/bin/env node
import { BlobServiceClient } from "@azure/storage-blob";

/**
 * ============================================================================
 *  O contêiner e o CORS do Azurite — chamado por `npm run local`
 * ============================================================================
 *
 * **Por que existe um script em vez de configuração declarativa.** O Azurite
 * não lê política de CORS de arquivo: ela se escreve pela API de propriedades
 * do serviço, depois que ele está de pé. Sem ela, o `PUT` do navegador para
 * `:10000` é recusado no *preflight* — e o erro aparece como "falha de rede",
 * que é o modo de falha mais caro de depurar.
 *
 * **Por que `127.0.0.1` aqui e `host.docker.internal` no `.env`.** Este script
 * roda no HOST; o `.env.local` é lido de dentro do contêiner e pelo navegador.
 * No runner Linux da esteira, `host.docker.internal` só resolve DENTRO de
 * contêiner — no host, não existe. Uma variável só, dois pontos de vista.
 *
 * **Este é o único arquivo de `ferramentas/` com dependência de npm**, e é por
 * isso que o emprego `compose` do `entrega.yml` ganhou um `npm ci`. Ver o
 * comentário daquele passo.
 *
 * As credenciais abaixo são as públicas do emulador, iguais em toda instalação.
 */
const CONEXAO =
  "DefaultEndpointsProtocol=http;" +
  "AccountName=devstoreaccount1;" +
  "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
  "BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

const servico = BlobServiceClient.fromConnectionString(CONEXAO);

const conteiner = servico.getContainerClient("anexos");
const criado = await conteiner.createIfNotExists();
console.log(criado.succeeded ? "   · contêiner `anexos` criado." : "   · contêiner `anexos` já existia.");

await servico.setProperties({
  cors: [
    {
      allowedOrigins: "*",
      allowedMethods: "PUT",
      allowedHeaders: "x-ms-blob-type,x-ms-blob-content-type,x-ms-tags,content-type",
      exposedHeaders: "",
      maxAgeInSeconds: 3600,
    },
  ],
});
console.log("   · CORS liberado para PUT (origem `*` — só no emulador local).");
