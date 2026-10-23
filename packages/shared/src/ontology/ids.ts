import { z } from "zod";

export const NamespacedId = z
  .string()
  .max(200)
  .regex(
    /^[a-z][a-z0-9-]*(:[A-Za-z0-9._\-/]+)+$/,
    'Expected a namespaced ID such as "pl:teryt:1465011"',
  );

export const ObjectId = NamespacedId.brand<"ObjectId">();
export type ObjectId = z.infer<typeof ObjectId>;

export const LinkId = NamespacedId.brand<"LinkId">();
export type LinkId = z.infer<typeof LinkId>;

export const SourceId = NamespacedId.brand<"SourceId">();
export type SourceId = z.infer<typeof SourceId>;

export const CountryCode = z.string().regex(/^[A-Z]{2}$/, "Expected an ISO 3166-1 alpha-2 code");
export type CountryCode = z.infer<typeof CountryCode>;
