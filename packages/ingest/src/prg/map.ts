import type { AreaGeometry, LinkInput, ObjectInput } from "@ariadne/shared";
import { MUNICIPALITY_TYPES } from "@ariadne/shared";
import type { z } from "zod";
import type { PrgFeature } from "./record.js";

export interface MappedUnit {
  object: z.input<typeof ObjectInput>;
  geometry: AreaGeometry;
  parentLink: z.input<typeof LinkInput> | null;
  recordRef: string;
}

export type MapResult = { ok: true; unit: MappedUnit } | { ok: false; problem: string };

const LEVELS = {
  WOJ: { adminLevel: 1, codeLength: 2 },
  POW: { adminLevel: 2, codeLength: 4 },
  GMI: { adminLevel: 3, codeLength: 7 },
} as const;

export function terytObjectId(code: string): string {
  return `pl:teryt:${code.length === 7 ? code.slice(0, 6) : code}`;
}

export function normalizeRegon(raw: string | null): string | null | undefined {
  const value = raw?.trim() ?? "";
  if (value === "" || value.toLowerCase() === "brak") {
    return null;
  }
  if (/^\d{14}$/.test(value)) {
    return value.endsWith("00000") ? value.slice(0, 9) : value;
  }
  if (/^\d{9}$/.test(value)) {
    return value;
  }
  return undefined;
}

type MunicipalityTypeName = (typeof MUNICIPALITY_TYPES)[keyof typeof MUNICIPALITY_TYPES];

function municipalityTypeOf(code: string): MunicipalityTypeName | undefined {
  const digit = code[6];
  return digit === "1" || digit === "2" || digit === "3" ? MUNICIPALITY_TYPES[digit] : undefined;
}

export function mapPrgFeature(feature: PrgFeature): MapResult {
  const p = feature.properties;
  const code = p.JPT_KOD_JE.trim();
  const level = LEVELS[p.JPT_SJR_KO];

  if (!/^\d+$/.test(code) || code.length !== level.codeLength) {
    return {
      ok: false,
      problem: `${p.JPT_SJR_KO} has code "${code}", expected ${String(level.codeLength)} digits`,
    };
  }

  const regon = normalizeRegon(p.REGON);
  if (regon === undefined) {
    return {
      ok: false,
      problem: `${code} has REGON "${p.REGON ?? ""}", which is not a valid number`,
    };
  }

  const municipalityType = p.JPT_SJR_KO === "GMI" ? municipalityTypeOf(code) : undefined;
  if (p.JPT_SJR_KO === "GMI" && municipalityType === undefined) {
    return { ok: false, problem: `${code} has municipality type digit "${code[6] ?? ""}"` };
  }

  const id = terytObjectId(code);
  const parentCode =
    p.JPT_SJR_KO === "GMI" ? code.slice(0, 4) : p.JPT_SJR_KO === "POW" ? code.slice(0, 2) : null;
  const parentId = parentCode === null ? null : terytObjectId(parentCode);

  const object: z.input<typeof ObjectInput> = {
    id,
    type: "Location",
    countryCode: "PL",
    displayName: p.JPT_NAZWA_.trim(),
    properties: {
      kind: "administrative_area",
      adminLevel: level.adminLevel,
      areaKm2: p.JPT_POWIER !== null && p.JPT_POWIER > 0 ? p.JPT_POWIER / 100 : null,
      countryData: {
        pl: {
          teryt: code,
          regon,
          ...(municipalityType === undefined ? {} : { municipalityType }),
        },
      },
    },
  };

  const parentLink: z.input<typeof LinkInput> | null =
    parentId === null
      ? null
      : {
          id: `${id}/located_in/${parentId}`,
          type: "located_in",
          fromObjectId: id,
          toObjectId: parentId,
          validFrom: null,
          validTo: null,
          confidence: null,
          properties: {},
        };

  return {
    ok: true,
    unit: {
      object,
      geometry: feature.geometry,
      parentLink,
      recordRef: `${p.IIP_PRZEST}/${p.IIP_IDENTY}`,
    },
  };
}
