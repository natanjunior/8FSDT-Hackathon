"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErroDoFormulario, IndicadorDeEnvio } from "@/interface/componentes/campo";
import { TEXTOS_DO_CONVITE_PESSOAL as TEXTOS, desfechoDoAceite } from "@/interface/componentes/convite-pessoal";
import { Button } from "@/interface/componentes/ui/button";

/**
 * **O botão *Entrar* do convite pessoal**, na face de quem já tem conta (item 121).
 *
 * `POST /convites-pessoais/{token}/aceite`, e a resposta passa por `desfechoDoAceite`: aceito vai para a
 * lista de ocorrências da organização, que o aceite tornou a ativa; *não vale* e *já participa* refazem a
 * página, que mostra a face certa; o resto, inclusive a rede, mostra a frase de falha acima do botão, e o
 * botão volta. **A fusão é tudo ou nada**, então tentar de novo é seguro.
 */
export function AceiteDoConvitePessoal({ token }: { token: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function aceitar() {
    if (enviando) return;
    setEnviando(true);
    setFalhou(false);
    let status = 0;
    try {
      const resposta = await fetch(`/api/convites-pessoais/${token}/aceite`, { method: "POST" });
      status = resposta.status;
    } catch {
      status = 0;
    }
    const desfecho = desfechoDoAceite(status);
    if (desfecho === "ir") return router.replace("/ocorrencias");
    if (desfecho === "refazer") return router.refresh();
    setFalhou(true);
    setEnviando(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {falhou && <ErroDoFormulario>{TEXTOS.falha}</ErroDoFormulario>}
      <Button
        type="button"
        variant="marca"
        disabled={enviando}
        onClick={() => void aceitar()}
        className="text-interface min-h-11 w-full font-semibold"
      >
        <IndicadorDeEnvio ativo={enviando} />
        {enviando ? TEXTOS.entrando : TEXTOS.entrar}
      </Button>
    </div>
  );
}
