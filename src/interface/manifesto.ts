import type { MetadataRoute } from "next";

/**
 * **A cor da marca, em hex — item 76, critério 10.** É o laranja do logotipo do dono, e o `--accent`
 * escuro do `globals.css` é a mesma cor em oklch (`tema.test.ts` confere a conversão). Mora em hex porque
 * `theme-color` e o manifesto não têm suporte confiável a oklch.
 *
 * **Uma cor só, nos dois temas**, porque `themeColor` e `theme_color` não sabem qual tema a pessoa
 * escolheu: o tema é um cookie, e não `prefers-color-scheme`. No claro o `--accent` continua o antigo
 * (`respostas.md` P1 do item 76), e a barra do navegador fica com o laranja do logo.
 */
export const COR_DA_MARCA = "#D17A4D";

/** O `--ground` escuro em hex: o produto abre escuro, e a tela de abertura do aplicativo é o chão dele. */
export const CHAO_ESCURO = "#14171c";

/**
 * **O manifesto do produto — critérios 76.11 e 76.12.** O do pacote de favicon dizia `"MyWebSite"`, com
 * `theme_color` branco, e não entrou. Os dois ícones são `any` e não `maskable`: a marca encosta na borda
 * do quadrado, e o recorte circular do Android cortaria a faísca e os cantos do R.
 */
export const MANIFESTO: MetadataRoute.Manifest = {
  name: "Resolve Aí",
  short_name: "Resolve Aí",
  start_url: "/",
  display: "standalone",
  theme_color: COR_DA_MARCA,
  background_color: CHAO_ESCURO,
  icons: [
    { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ],
};
