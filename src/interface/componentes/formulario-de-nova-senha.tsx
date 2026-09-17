"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { acaoDeDefinirSenha, type EstadoDoFormulario } from "@/interface/acoes";
import { chamarAcaoDeCredencial } from "@/interface/componentes/acao-de-credencial";
import { Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { Aviso } from "@/interface/componentes/moldura-de-tela";
import {
  avisarErro,
  avisarSucesso,
  MENSAGEM_GENERICA,
} from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";
import { definirSenhaSchema, errosDoSchema } from "@/interface/schemas";

/**
 * **T-13 · Definir nova senha.** Um campo de senha, **sem pedir a antiga** — quem chegou aqui é justamente
 * quem não a tem (inventário, T-13). É o critério 2.
 *
 * A regra de força aparece **antes** de digitar, como em T-11, e evita o modo de falha mais comum de um
 * cadastro: a pessoa escolhe, envia, e descobre a regra como erro.
 *
 * **O retorno (guia §7, item 44g).** Com a senha gravada, sai o aviso *"Senha alterada"* e a tela segue
 * para T-01; a ação devolve `concluido` em vez de redirecionar, porque o aviso só sai do navegador. A falha
 * dá o aviso *"Não foi possível definir a senha"*.
 */
export function FormularioDeNovaSenha() {
  const router = useRouter();
  const formulario = useFormularioTocado({
    campos: { senha: "senha" },
    validar: (dados) => errosDoSchema(definirSenhaSchema, { senha: dados.get("senha") }),
  });

  const [estado, agir, aguardando] = useActionState(
    async (anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> => {
      const proximo = await chamarAcaoDeCredencial(acaoDeDefinirSenha, anterior, dados);
      formulario.recomecar();
      if (proximo.concluido === true) {
        avisarSucesso("Senha alterada", "Entre com ela.");
        // **`replace`, e não `push`:** o botão voltar não pode reencontrar este formulário (6b.4). A
        // ação já limpou o cookie de recuperação, então a própria página também manda para T-01.
        router.replace("/entrar");
      } else if (proximo.recusa !== undefined || proximo.erros !== undefined) {
        avisarErro("Não foi possível definir a senha");
      }
      return proximo;
    },
    {},
  );

  return (
    <>
      {estado.recusa !== undefined && <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>}

      <p className="text-tinta-suave text-sm leading-relaxed">
        Escolha a senha que você vai usar para entrar.
      </p>

      <form
        action={agir}
        onChange={formulario.aoMudarNoFormulario}
        onSubmit={formulario.aoEnviarFormulario}
        className="flex flex-col gap-5"
        noValidate
      >
        <Campo
          id="senha"
          rotulo="Nova senha"
          obrigatorio
          // **A MESMA frase de T-11, e o mesmo número** — seis, comprimento e nada mais (item 6a, §3.3),
          // que é também o `minimum_password_length` do `supabase/config.toml`. O protótipo desenha aqui
          // "Pelo menos 8 caracteres · Uma letra e um número": é o achado **A-6b-1**, e não se conserta
          // nesta linha — duas regras para a mesma senha seria pior que uma divergência registrada.
          ajuda="No mínimo 6 caracteres."
          erro={formulario.erroDe("senha", estado.erros)}
        >
          {(controle) => (
            <Input
              {...controle}
              name="senha"
              type="password"
              autoComplete="new-password"
              required
              className="h-12 text-base"
            />
          )}
        </Campo>

        <RodapeDoFormulario obrigatorios={1}>
          <Button type="submit" disabled={aguardando} className="h-12 px-6 text-base">
            <IndicadorDeEnvio ativo={aguardando} />
            {aguardando ? "Definindo…" : "Definir a senha"}
          </Button>
        </RodapeDoFormulario>
      </form>
    </>
  );
}

function textoDaRecusa(recusa: string): string {
  // `SENHA_IGUAL_A_ANTERIOR` não pode cair na frase da regra de força: mandar "escolher uma senha mais
  // longa" quem escolheu uma senha boa e só repetiu a antiga é mandar consertar o que está certo.
  if (recusa === "SENHA_IGUAL_A_ANTERIOR") return "Escolha uma senha diferente da anterior.";
  if (recusa === "SENHA_RECUSADA_PELO_PROVEDOR") return "Escolha uma senha mais longa.";
  return MENSAGEM_GENERICA;
}
