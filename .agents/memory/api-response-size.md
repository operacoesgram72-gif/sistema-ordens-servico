---
name: API response size — photos/signature in list endpoints
description: List endpoints must never select photos/signature columns — they contain base64 blobs
---

## Rule: list endpoints must use explicit column selection
`db.select()` without arguments returns ALL columns, including `photos` and `signature` on `serviceOrdersTable`. These fields contain base64-encoded images — each can be hundreds of KB. Returning them for every row in a list makes the response balloon to tens of MBs.

**The effect observed:** `/api/service-orders?unidade=AM` returned **76 MB** with only ~45 rows. The browser never finished downloading it, causing infinite loading skeletons and apparent 502/503 errors on production (memory/timeout).

**Fix applied:** `db.select(LIST_COLUMNS)` where `LIST_COLUMNS` is a const object listing every column except `photos` and `signature`. The detail endpoint (`GET /service-orders/:id`) and the POST response still return all columns.

**Why:** The list view doesn't render photos — that's only for the OS detail page. Sending them in the list is pure waste.

**How to apply:** Any time you add a new list/index endpoint that queries `serviceOrdersTable`, use `LIST_COLUMNS` (defined in routes/service-orders.ts) instead of bare `db.select()`. Same principle applies if other tables ever get blob/base64 columns — always define explicit LIST_COLUMNS for those too.
