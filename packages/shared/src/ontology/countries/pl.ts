import { z } from "zod";

export const TerytCode = z.string().regex(/^\d{2}(\d{2}(\d{3})?)?$/, "Expected 2, 4 or 7 digits");

export const MUNICIPALITY_TYPES = {
  "1": "urban",
  "2": "rural",
  "3": "urban_rural",
} as const;
export const MunicipalityType = z.enum(["urban", "rural", "urban_rural"]);

export const Regon = z.string().regex(/^(\d{9}|\d{14})$/, "Expected 9 or 14 digits");

export const PlAdministrativeAreaData = z
  .strictObject({
    teryt: TerytCode,
    municipalityType: MunicipalityType.optional(),
    regon: Regon.nullable(),
  })
  .refine(
    (data) =>
      data.teryt.length === 7
        ? data.municipalityType ===
          MUNICIPALITY_TYPES[data.teryt[6] as keyof typeof MUNICIPALITY_TYPES]
        : data.municipalityType === undefined,
    {
      message: "municipalityType must match the 7th digit of a municipality's TERYT code",
      path: ["municipalityType"],
    },
  );
export type PlAdministrativeAreaData = z.infer<typeof PlAdministrativeAreaData>;

export const ADMIN_LEVEL_BY_TERYT_LENGTH: Record<number, number> = { 2: 1, 4: 2, 7: 3 };
