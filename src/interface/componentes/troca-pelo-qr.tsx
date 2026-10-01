"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Aviso } from "@/interface/componentes/campo";
import { CLASSE_DO_CAMINHO } from "@/interface/componentes/moldura-de-conta";
import { TEXTOS_DO_QR } from "@/interface/componentes/qr-da-area";
import { trocarOrganizacao } from "@/interface/componentes/troca-de-organizacao";

/**
 * ============================================================================
 *  A troca pelo QR — o `PUT /contexto/organizacao` de sempre (item 111)
 * ============================================================================
 *
 * **Server Component não grava cookie, e uma rota que trocasse e redirecionasse seria o sexto consumidor de
 * `semOrganizacao`**, a lista fechada da ADR-0003. Então quem troca é o cliente, pelo mesmo módulo dos três
 * chamadores de hoje, e quem grava o cookie é o handler, uma vez (critério 3).
 *
 * **`useRef` segura a segunda execução do efeito** que o modo estrito faz em desenvolvimento: dois `PUT`
 * seriam duas respostas com cookie, inofensivas, mas o critério pede uma.
 *
 * **`replace` e não `push`**, pela razão de `escolha-de-organizacao.tsx`: *voltar* não pode levar a uma tela
 * da organização anterior.
 */
export function TrocaPeloQr({ organizacaoId, para }: { organizacaoId: string; para: string }) {
  const router = useRouter();
  const comecou = useRef(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (comecou.current) return;
    comecou.current = true;
    void trocarOrganizacao(organizacaoId).then((resultado) => {
      if (resultado.ok) router.replace(para);
      else setAviso(resultado.aviso);
    });
  }, [organizacaoId, para, router]);

  if (aviso === null) {
    return (
      <p role="status" className="text-tinta-suave text-interface">
        {TEXTOS_DO_QR.trocando}
      </p>
    );
  }

  return (
    <>
      <Aviso>{aviso}</Aviso>
      <Link href="/" className={CLASSE_DO_CAMINHO}>
        {TEXTOS_DO_QR.naoEncontrado.acao}
      </Link>
    </>
  );
}
