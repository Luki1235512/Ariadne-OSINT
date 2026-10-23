import { z } from "zod";
import { CountryCode, LinkId, ObjectId } from "./ids.js";

// ---- Object types ----

export const LocationProperties = z.strictObject({});

const objectBase = {
  id: ObjectId,
  countryCode: CountryCode.nullable(),
  displayName: z.string().trim().min(1).max(500),
};

export const LocationInput = z.strictObject({
  ...objectBase,
  type: z.literal("Location"),
  properties: LocationProperties,
});

const objectSchemas = [LocationInput] as const;
export const ObjectInput = z.discriminatedUnion("type", objectSchemas);
export type ObjectInput = z.infer<typeof ObjectInput>;
export type ObjectType = ObjectInput["type"];
export const OBJECT_TYPES: readonly ObjectType[] = objectSchemas.map(
  (schema) => schema.shape.type.value,
);

// ---- Link types ----

export const CalendarDate = z.iso.date();

const linkBase = {
  id: LinkId,
  fromObjectId: ObjectId,
  toObjectId: ObjectId,
  validFrom: CalendarDate.nullable(),
  validTo: CalendarDate.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
};

export const LocatedInInput = z.strictObject({
  ...linkBase,
  type: z.literal("located_in"),
  properties: z.strictObject({}),
});

const linkSchemas = [LocatedInInput] as const;
export const LinkInput = z
  .discriminatedUnion("type", linkSchemas)
  .refine((link) => link.fromObjectId !== link.toObjectId, {
    message: "A link cannot connect an object to itself",
    path: ["toObjectId"],
  })
  .refine(
    (link) => link.validFrom === null || link.validTo === null || link.validFrom <= link.validTo,
    {
      message: "validTo must not be before validFrom",
      path: ["validTo"],
    },
  );
export type LinkInput = z.infer<typeof LinkInput>;

export type LinkType = LinkInput["type"];
export const LINK_TYPES: readonly LinkType[] = linkSchemas.map((schema) => schema.shape.type.value);

export const LINK_ENDPOINTS: Record<
  LinkType,
  { from: readonly ObjectType[]; to: readonly ObjectType[] }
> = {
  located_in: { from: ["Location"], to: ["Location"] },
};
