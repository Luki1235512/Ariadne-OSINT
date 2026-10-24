import { z } from "zod";
import { ObjectId, SourceId } from "./ids.js";

const Longitude = z.number().min(-180).max(180);
const Latitude = z.number().min(-90).max(90);
export const Position = z.tuple([Longitude, Latitude]);

const LinearRing = z
  .array(Position)
  .min(4)
  .refine(
    (ring) => {
      const first = ring[0];
      const last = ring.at(-1);
      return first?.[0] === last?.[0] && first?.[1] === last?.[1];
    },
    { message: "A ring must end with its first position" },
  );

export const GeoJsonPolygon = z.strictObject({
  type: z.literal("Polygon"),
  coordinates: z.array(LinearRing).min(1),
});

export const GeoJsonMultiPolygon = z.strictObject({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(LinearRing).min(1)).min(1),
});

export const AreaGeometry = z.discriminatedUnion("type", [GeoJsonPolygon, GeoJsonMultiPolygon]);
export type AreaGeometry = z.infer<typeof AreaGeometry>;

export const BoundaryInput = z.strictObject({
  objectId: ObjectId,
  sourceId: SourceId,
  geometry: AreaGeometry,
});
export type BoundaryInput = z.infer<typeof BoundaryInput>;
