# ST-005 — Realtime provenance details

Parent: Task 04
Priority: P2
Status: proposed

## Goal

Make cross-client changes explainable without inventing agent identity.

## Checklist

- [ ] preserve `$createdAt`, `$createdBy`, `$updatedAt`, `$updatedBy` access;
- [ ] add compact writer details affordance where IDs are meaningful;
- [ ] use exact Jazz provenance values;
- [ ] label a writer as an agent only when application metadata proves that mapping;
- [ ] keep raw writer IDs copyable;
- [ ] test realtime update changes both visible value and provenance when supplied by Jazz.

## Acceptance

The UI can answer “who/what last wrote this?” to the extent the database actually records it, without fabricating semantic identity.
