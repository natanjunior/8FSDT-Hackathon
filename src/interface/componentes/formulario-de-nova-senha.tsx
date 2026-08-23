"use client";

import { useActionState } from "react";

import { acaoDeDefinirSenha } from "@/interface/acoes";
import { Aviso, Campo } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **T-13 · Definir nova senha.** Um campo de senha, **sem pedir a antiga** — quem chegou aqui é justamente
 * quem não a tem (inventário, T-13). É o critério 2.
 *
 * A regra de força aparece **antes** de digitar, como em T-11, e evita o modo de falha mais comum de um
 * cadastro: a pessoa escolhe, envia, e descobre a regra como erro.
 */
export function FormularioDeNovaSenha() {
  const [estado, agir, aguardando] = useActionState(acaoDeDefinirSenha, {});

  return (
    <>
      {estado.recusa !== undefined && <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>}

      <p className="text-tinta-suave text-sm leading-relaxed">
        Escolha a senha que você vai usar para entrar.
      </p>

      <form action={agir} className="flex flex-col gap-5" noValidate>
        <Campo
          id="senha"
          rotulo="Nova senha"
          // **A MESMA frase de T-11, e o mesmo número** — seis, comprimento e nada mais (item 6a, §3.3),
          // que é também o `minimum_password_length` do `supabase/config.toml`. O protótipo desenha aqui
          // "Pelo menos 8 caracteres · Uma letra e um número": é o achado **A-6b-1**, e não se conserta
          // nesta linha — duas regras para a mesma senha seria pior que uma divergência registrada.
          ajuda="No mínimo 6 caracteres."
          erro={estado.erros?.["senha"]}
        >
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={estado.erros?.["senha"] !== undefined}
            className="h-12 text-base"
          />
        </Campo>

        <Button type="submit" disabled={aguardando} className="h-12 w-full text-base">
          {aguardando ? "Definindo…" : "Definir a senha"}
        </Button>
      </form>
    </>
  );
}

function textoDaRecusa(recusa: string): string {
  // `SENHA_IGUAL_A_ANTERIOR` não pode cair na frase da regra de força: mandar "escolher uma senha mais
  // longa" quem escolheu uma senha boa e só repetiu a antiga é mandar consertar o que está certo.
  if (recusa === "SENHA_IGUAL_A_ANTERIOR") return "Escolha uma senha diferente da anterior.";
  if (recusa === "SENHA_RECUSADA_PELO_PROVEDOR") return "Escolha uma senha mais longa.";
  return "Não foi possível definir a senha agora. Tente de novo em instantes.";
}
