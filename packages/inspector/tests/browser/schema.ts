import { col, defineApp, definePermissions, type Schema, type App } from "jazz-tools";

export const SPECIAL_CHARACTER_TABLE = "reports/ready ?#%" as const;

const schema = {
  todos: {
    title: col.string(),
    done: col.boolean(),
  },
  [SPECIAL_CHARACTER_TABLE]: {
    title: col.string(),
  },
};

type AppSchema = Schema<typeof schema>;

export const app: App<AppSchema> = defineApp(schema);

export const permissions = definePermissions(app, ({ policy }) => {
  policy.todos.allowRead.where({});
  policy.todos.allowInsert.never();
  policy.todos.allowUpdate.never();
  policy.todos.allowDelete.never();

  policy[SPECIAL_CHARACTER_TABLE].allowRead.where({});
  policy[SPECIAL_CHARACTER_TABLE].allowInsert.never();
  policy[SPECIAL_CHARACTER_TABLE].allowUpdate.never();
  policy[SPECIAL_CHARACTER_TABLE].allowDelete.never();
});
