# Full snippet — two-writer realtime Playwright acceptance

The important property is no page reload between writer-B mutations and writer-A assertions.

```ts
test("reflects independent Jazz writer changes without refresh", async ({ page }) => {
  await connectInspector(page);
  await openTable(page, "todos");

  const writer = await createBackendTestWriter();
  const id = crypto.randomUUID();

  await writer.insertTodo({ id, title: "from writer B", done: false });
  await expect(page.getByRole("gridcell", { name: id })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("gridcell", { name: "from writer B" })).toBeVisible();

  await writer.updateTodo(id, { title: "writer B updated" });
  await expect(page.getByRole("gridcell", { name: "writer B updated" })).toBeVisible({
    timeout: 15_000,
  });

  await writer.deleteTodo(id);
  await expect(page.getByRole("gridcell", { name: id })).toBeHidden({ timeout: 15_000 });

  await writer.close();
});
```

Test helper contract:

```ts
interface BackendTestWriter {
  insertTodo(row: { id: string; title: string; done: boolean }): Promise<void>;
  updateTodo(id: string, patch: { title?: string; done?: boolean }): Promise<void>;
  deleteTodo(id: string): Promise<void>;
  close(): Promise<void>;
}
```

The helper should use a genuinely separate backend-scoped Jazz client and wait for the durability level required by the test environment.
