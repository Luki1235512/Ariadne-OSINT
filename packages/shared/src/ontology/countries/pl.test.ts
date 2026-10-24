import { describe, expect, it } from "vitest";
import { PlAdministrativeAreaData, Regon, TerytCode } from "./pl.js";

describe("TerytCode", () => {
  it.each(["14", "0401", "1007013"])("accepts %s", (code) => {
    expect(TerytCode.safeParse(code).success).toBe(true);
  });

  it.each(["1", "140", "100701", "10070131", "14a1"])("rejects %s", (code) => {
    expect(TerytCode.safeParse(code).success).toBe(false);
  });
});

describe("Regon", () => {
  it.each(["015528910", "01552891000000"])("accepts %s", (regon) => {
    expect(Regon.safeParse(regon).success).toBe(true);
  });

  it.each(["0155289", "0155289100000", "01552891x"])("rejects %s", (regon) => {
    expect(Regon.safeParse(regon).success).toBe(false);
  });
});

describe("PlAdministrativeAreaData", () => {
  it("accepts a municipality whose type matches the 7th digit", () => {
    const data = { teryt: "1007013", municipalityType: "urban_rural", regon: "590647820" };
    expect(PlAdministrativeAreaData.safeParse(data).success).toBe(true);
  });

  it("rejects a municipality type that contradicts the 7th digit", () => {
    const data = { teryt: "1007013", municipalityType: "rural", regon: null };
    expect(PlAdministrativeAreaData.safeParse(data).success).toBe(false);
  });

  it("requires a municipality type for municipalities", () => {
    expect(PlAdministrativeAreaData.safeParse({ teryt: "1007013", regon: null }).success).toBe(
      false,
    );
  });

  it("rejects a municipality type on a county", () => {
    const data = { teryt: "0401", municipalityType: "urban", regon: null };
    expect(PlAdministrativeAreaData.safeParse(data).success).toBe(false);
  });

  it("rejects a 7-digit code whose type digit is not 1, 2 or 3", () => {
    const data = { teryt: "1007014", municipalityType: "urban", regon: null };
    expect(PlAdministrativeAreaData.safeParse(data).success).toBe(false);
  });
});
