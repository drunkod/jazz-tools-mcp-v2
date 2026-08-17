# Full snippet — MCP -> Jazz -> Inspector realtime demo

## Terminal A — Jazz/MCP server

```bash
npm install
npm run build
npm start
```

Use the repository's actual server command if it differs; record the exact command in the demo runbook once stabilized.

## Terminal B — Inspector

```bash
cd packages/inspector
pnpm install --frozen-lockfile
pnpm dev
```

Open the Inspector, connect to the development Jazz app, select the active schema, and open the target table.

## Terminal C — MCP client/agent

Sequence:

```text
1. list/inspect runtime tables
2. insert a test row
3. capture returned row ID
4. observe row appear in Inspector without refresh
5. update same ID
6. observe cell/provenance change without refresh
7. delete same ID
8. observe row disappear without refresh
```

Pseudo-tool calls:

```json
{"tool":"insert","table":"todos","values":{"title":"MCP realtime demo","done":false}}
{"tool":"update","table":"todos","id":"<RETURNED_ID>","values":{"done":true}}
{"tool":"delete","table":"todos","id":"<RETURNED_ID>"}
```

## Reverse-flow proof

From Inspector:

1. stage an insert;
2. Save changes;
3. query the table through MCP and locate the returned/visible ID;
4. edit the row in Inspector and Save;
5. query through MCP again and verify the new value;
6. delete in Inspector and verify the MCP query no longer returns it.

## Demo acceptance

- no browser refresh between writes and observations;
- no hard-coded row ID;
- actual Jazz mutations, not mocked network responses;
- provenance shown only when supplied by Jazz;
- cleanup removes test data.
