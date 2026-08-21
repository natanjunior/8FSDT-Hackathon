/**
 * A moldura das telas de celular.
 *
 * O protótipo desenha as duas telas da fatia com a mesma forma — marca, título, e uma coluna de campos que
 * cabe sem rolar (`docs/prototipo/telas.html`, T-01 e T-02). Escrito uma vez, pela razão que o próprio
 * protótipo declara: *"duas cópias divergem na primeira alteração, e a divergente é pior que a ausente"*.
 */
export function MolduraDeTela({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-6 pt-10 pb-12">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
      <h1 className="text-tinta text-xl leading-snug font-semibold">{titulo}</h1>
      {children}
    </main>
  );
}

/**
 * Um campo: rótulo associado ao controle, e o texto de ajuda ou de erro embaixo dele.
 *
 * **Compromisso de acessibilidade A-1** do protótipo (§8): *"todo campo tem rótulo associado ao controle.
 * `placeholder` não é rótulo — se o texto some ao digitar, está errado."* Por isso o `htmlFor` é obrigatório
 * aqui, e não opcional: um campo sem rótulo não compila.
 *
 * E **A-5**: nada é comunicado só por cor. O erro leva `role="alert"`, e a mensagem é texto.
 */
export function Campo({
  id,
  rotulo,
  ajuda,
  erro,
  children,
}: {
  id: string;
  rotulo: string;
  ajuda?: React.ReactNode;
  erro?: string;
  children: React.ReactNode;
}) {
  const idDaAjuda = ajuda === undefined ? undefined : `${id}-ajuda`;
  const idDoErro = erro === undefined ? undefined : `${id}-erro`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-tinta text-sm font-medium">
        {rotulo}
      </label>
      {children}
      {ajuda !== undefined && (
        <span id={idDaAjuda} className="text-tinta-suave text-xs leading-relaxed">
          {ajuda}
        </span>
      )}
      {erro !== undefined && (
        <span id={idDoErro} role="alert" className="text-marca text-xs font-medium">
          {erro}
        </span>
      )}
    </div>
  );
}

/**
 * A linha de aviso acima do formulário.
 *
 * `tom="recusa"` para credencial recusada; `tom="nota"` para *"Conta confirmada. Entre para continuar."* —
 * são os dois estados que o protótipo desenha para T-01, e a diferença entre eles é de peso visual, não de
 * cor sozinha (A-5).
 */
export function Aviso({
  tom = "recusa",
  children,
}: {
  tom?: "recusa" | "nota";
  children: React.ReactNode;
}) {
  const estilo =
    tom === "recusa"
      ? "border-marca/40 bg-accent text-tinta"
      : "border-linha bg-superficie text-tinta-suave";

  return (
    <p role="alert" className={`rounded-md border px-3 py-2.5 text-sm ${estilo}`}>
      {children}
    </p>
  );
}
