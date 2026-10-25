import { AreaGeometry } from "@ariadne/shared";
import { z } from "zod";

export const PrgFeature = z.strictObject({
  type: z.literal("Feature"),
  properties: z.strictObject({
    JPT_KOD_JE: z.string(),
    JPT_SJR_KO: z.enum(["WOJ", "POW", "GMI"]),
    JPT_NAZWA_: z.string(),
    JPT_POWIER: z.number().nullable(),
    IIP_PRZEST: z.string(),
    IIP_IDENTY: z.string(),
    REGON: z.string().nullable(),
  }),
  geometry: AreaGeometry,
});
export type PrgFeature = z.infer<typeof PrgFeature>;
