import { z } from "zod";
import { SourceId } from "./ids.js";

export const SourceInput = z.strictObject({
  id: SourceId,
  name: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(300),
  url: z.url({ protocol: /^https?$/ }),
  license: z.string().trim().min(1).max(200),
  licenseUrl: z.url({ protocol: /^https?$/ }).nullable(),
  retrievedAt: z.iso.datetime({ offset: true }),
});
export type SourceInput = z.infer<typeof SourceInput>;

export const SourceReference = z.strictObject({
  sourceId: SourceId,
  recordRef: z.string().trim().min(1).max(1000),
});
export type SourceReference = z.infer<typeof SourceReference>;
