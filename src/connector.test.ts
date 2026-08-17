import test from "node:test";
import assert from "node:assert/strict";
import { pickLatestSchemaHash } from "./connector.js";
import {
  GenericQueryBuilder,
  assertOrderByColumns,
  assertQueryableColumns,
  assertWhereInput,
  assertWritableColumns,
  dynamicTableProxy,
} from "./query.js";
import type { WasmSchema } from "jazz-tools";

const schema = {
  todos: {
    columns: [
      { name: "title", column_type: { type: "Text" }, nullable: false },
      { name: "done", column_type: { type: "Boolean" }, nullable: false },
      { name: "priority", column_type: { type: "Integer" }, nullable: false },
      { name: "payload", column_type: { type: "Json" }, nullable: false },
      { name: "blob", column_type: { type: "Bytea" }, nullable: false },
    ],
  },
} as unknown as WasmSchema;

test("pickLatestSchemaHash prefers greatest publishedAt", () => {
  assert.equal(
    pickLatestSchemaHash({
      hashes: ["a", "b"],
      schemas: [
        { hash: "b", publishedAt: 20 },
        { hash: "a", publishedAt: 10 },
      ],
    }),
    "b",
  );
});

test("pickLatestSchemaHash falls back to last hash", () => {
  assert.equal(
    pickLatestSchemaHash({
      hashes: ["a", "b"],
      schemas: [
        { hash: "a", publishedAt: null },
        { hash: "b", publishedAt: null },
      ],
    }),
    "b",
  );
});

test("GenericQueryBuilder emits Jazz query JSON, not SQL", () => {
  const query = new GenericQueryBuilder("todos", schema)
    .where({ done: false, title: { contains: "ship" } })
    .orderBy([{ column: "title", direction: "asc" }])
    .limit(10)
    .offset(5);

  const built = JSON.parse(query._build()) as Record<string, unknown>;
  assert.equal(built.table, "todos");
  assert.deepEqual(built.conditions, [
    { column: "done", op: "eq", value: false },
    { column: "title", op: "contains", value: "ship" },
  ]);
  assert.equal(built.limit, 10);
  assert.equal(built.offset, 5);
});

test("dynamicTableProxy implements Jazz mutation proxy shape", () => {
  const proxy = dynamicTableProxy("todos", schema);
  assert.equal(proxy._table, "todos");
  assert.equal(proxy._schema, schema);
});

test("query validation accepts Jazz magic columns", () => {
  assert.doesNotThrow(() =>
    assertQueryableColumns(schema, "todos", ["id", "$createdBy", "$updatedAt"]),
  );
  assert.doesNotThrow(() =>
    assertWhereInput(schema, "todos", {
      $createdBy: { contains: "agent" },
      $updatedAt: { gte: 0 },
    }),
  );
});

test("where validation rejects operators not supported by the column type", () => {
  assert.throws(
    () => assertWhereInput(schema, "todos", { done: { contains: true } }),
    /Unsupported where operator/,
  );
  assert.doesNotThrow(() =>
    assertWhereInput(schema, "todos", { priority: { gte: 2, lt: 10 } }),
  );
});

test("orderBy validation rejects Jazz Bytea and Json columns", () => {
  assert.doesNotThrow(() =>
    assertOrderByColumns(schema, "todos", ["title", "priority", "$updatedAt"]),
  );
  assert.throws(() => assertOrderByColumns(schema, "todos", ["payload"]), /orderBy/);
  assert.throws(() => assertOrderByColumns(schema, "todos", ["blob"]), /orderBy/);
});

test("mutation validation rejects id and magic columns", () => {
  assert.doesNotThrow(() => assertWritableColumns(schema, "todos", ["title", "done"]));
  assert.throws(() => assertWritableColumns(schema, "todos", ["id"]), /non-writable/);
  assert.throws(
    () => assertWritableColumns(schema, "todos", ["$createdBy"]),
    /non-writable/,
  );
});
