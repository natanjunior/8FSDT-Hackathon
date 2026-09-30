import { MENSAGEM_DE_LIMPEZA, PRAZO_DA_LIMPEZA_MS } from "./constantes";

/**
 * **A saída apaga os caches da origem** (critério 98.3). Com trabalhador no controle, o pedido vai a ele,
 * que apaga tudo e volta a semear só a casca e a hora; sem trabalhador, ou se ele não responder no prazo,
 * a página apaga ela mesma. Em janela privada o `caches` pode faltar ou lançar, e a saída segue.
 */
export async function limparCachesDaOrigem(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const controlador = navigator.serviceWorker?.controller ?? null;
    if (controlador !== null && (await pedirAoTrabalhador(controlador))) return;
    const nomes = await caches.keys();
    await Promise.all(nomes.map((nome) => caches.delete(nome)));
  } catch {
    // Sem armazenamento acessível, não há o que apagar.
  }
}

function pedirAoTrabalhador(controlador: ServiceWorker): Promise<boolean> {
  return new Promise((resolver) => {
    const canal = new MessageChannel();
    // A porta é fechada nos dois caminhos: porta aberta segura o processo no Node do teste.
    const desistir = setTimeout(() => {
      canal.port1.close();
      resolver(false);
    }, PRAZO_DA_LIMPEZA_MS);
    canal.port1.onmessage = () => {
      clearTimeout(desistir);
      canal.port1.close();
      resolver(true);
    };
    controlador.postMessage({ tipo: MENSAGEM_DE_LIMPEZA }, [canal.port2]);
  });
}
