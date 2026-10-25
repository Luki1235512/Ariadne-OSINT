import type { SourceInput } from "@ariadne/shared";
import type { z } from "zod";

export function prgSource(release: string, retrievedOn: string): z.input<typeof SourceInput> {
  return {
    id: `pl:gugik:prg:${release}`,
    name: `PRG – jednostki administracyjne (stan z ${release})`,
    publisher: "Główny Urząd Geodezji i Kartografii",
    url: "https://opendata.geoportal.gov.pl/prg/granice/00_jednostki_administracyjne.zip",
    license: "Bezpłatne, do dowolnego wykorzystania (Dz.U. 2021 poz. 1373)",
    licenseUrl: "https://www.geoportal.gov.pl/pl/dane/panstwowy-rejestr-granic-prg/",
    retrievedAt: `${retrievedOn}T00:00:00Z`,
  };
}

export const PRG_SOURCE_PREFIX = "pl:gugik:prg:";
