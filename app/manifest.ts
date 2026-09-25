import type { MetadataRoute } from "next";

import { MANIFESTO } from "@/interface/manifesto";

/** A convenção do Next para o manifesto. O conteúdo mora em `src/`, onde o teste o alcança. */
export default function manifest(): MetadataRoute.Manifest {
  return MANIFESTO;
}
