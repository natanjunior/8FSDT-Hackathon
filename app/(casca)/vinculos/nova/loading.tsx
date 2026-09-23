/**
 * O cold start de *Cadastrar pessoa sem conta* (RNF5). **O título é o mesmo da página e o do estado sem
 * acesso**, e o esqueleto tem a forma dos dois cartões. O caminho do topo não entra no esqueleto: ele é
 * rastro, e rastro em esqueleto é ruído.
 */
export default function EsperandoOCadastro() {
  return (
    <div className="flex flex-col gap-5.5">
      <h1 className="text-titulo-pagina text-tinta">Cadastrar pessoa sem conta</h1>

      <div aria-hidden className="flex flex-col gap-5.5">
        {["pessoa", "contatos"].map((cartao) => (
          <div
            key={cartao}
            className="border-linha bg-superficie flex flex-col gap-4 rounded-lg border p-[15px] shadow-sm md:p-[18px]"
          >
            <div className="bg-secondary h-6 w-[30%] animate-pulse rounded" />
            <div className="bg-secondary h-11 animate-pulse rounded" />
            <div className="bg-secondary h-11 animate-pulse rounded" />
          </div>
        ))}
      </div>

      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
