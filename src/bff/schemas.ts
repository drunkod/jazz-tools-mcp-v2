import * as z from "zod/v4";
import type { Capability } from "./ports.js";

const identifier = z.string().min(1).max(256);
const schemaHash = z.string().min(1).max(256);
const connectionId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const tableName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/);
const jsonObject = z.record(z.string().min(1).max(128), z.unknown());

export const queryRequestSchema = z
  .object({
    connectionId,
    schemaHash,
    table: tableName,
    where: jsonObject.optional(),
    select: z.array(identifier).min(1).max(128).optional(),
    orderBy: z
      .array(
        z
          .object({
            column: identifier,
            direction: z.enum(["asc", "desc"]).optional(),
          })
          .strict(),
      )
      .max(32)
      .optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).max(1_000_000).default(0),
  })
  .strict();

const mutationValues = jsonObject
  .superRefine((values, context) => {
    if (Object.keys(values).length > 64) {
      context.addIssue({ code: "custom", message: "Too many mutation fields" });
    }
    for (const key of Object.keys(values)) {
      if (key === "id" || key.startsWith("$")) {
        context.addIssue({ code: "custom", message: `Mutation field ${key} is not writable` });
      }
    }
  });

const insertOperation = z
  .object({
    clientMutationId: identifier,
    kind: z.literal("insert"),
    values: mutationValues,
  })
  .strict();
const updateOperation = z
  .object({
    clientMutationId: identifier,
    kind: z.literal("update"),
    rowId: identifier,
    values: mutationValues,
  })
  .strict();
const deleteOperation = z
  .object({
    clientMutationId: identifier,
    kind: z.literal("delete"),
    rowId: identifier,
  })
  .strict();

export const mutationOperationSchema = z.discriminatedUnion("kind", [
  insertOperation,
  updateOperation,
  deleteOperation,
]);

export const mutationsRequestSchema = z
  .object({
    connectionId,
    schemaHash,
    table: tableName,
    reason: z.string().trim().min(1).max(1_000),
    elevationId: identifier.optional(),
    operations: z.array(mutationOperationSchema).min(1).max(50),
  })
  .strict();

export const elevationRequestSchema = z
  .object({
    connectionId,
    capability: z.enum(["schema:read", "data:read", "data:mutate"]),
    reason: z.string().trim().min(1).max(1_000),
    reauthenticationProof: z.string().min(1).max(4_096),
  })
  .strict();

export const errorResponseSchema = z
  .object({
    requestId: z.string().min(1),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type MutationsRequest = z.infer<typeof mutationsRequestSchema>;
export type MutationOperation = z.infer<typeof mutationOperationSchema>;
export type ElevationRequestBody = z.infer<typeof elevationRequestSchema>;
export type CapabilityValue = z.infer<typeof elevationRequestSchema>["capability"] & Capability;
