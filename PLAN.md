# Demo Refactor Plan ✓ DONE

## Issues Found

### 1. Query Options Scattered
- `usersListQueryOptions` centralized ✓
- `userDetailQueryOptions` duplicated in `user-detail-direct.tsx` AND `user-update-direct.tsx`
- `user-delete-direct.tsx` uses inline query config

### 2. Pattern Mismatch in `user-detail-direct.tsx`
- Index says "Pattern C - data-ops"
- File uses `getUserDirect` (service binding = Pattern B)
- Header says "Binding" which contradicts index listing

### 3. State Management Inconsistent
- `user-detail-direct.tsx`: local state for userId
- `user-update-direct.tsx`: URL search params for userId

### 4. SSR Loader Missing
- `user-delete-direct.tsx` fetches list but no loader
- Index marks "Client Only" - correct but inconsistent with other data-ops demos

### 5. Back Link Only in Delete Demo
- Inconsistent navigation pattern

### 6. placeholderData Missing
- `user-delete-direct.tsx` query lacks placeholderData

---

## Plan

### Step 1: Centralize Query Options
**File: `src/lib/query-keys.ts`**
- Add `userDetailQueryOptions(id, queryFn)` - takes queryFn param to support both binding/data-ops
- Add `usersListDataOpsQueryOptions(params)` for data-ops list queries

### Step 2: Fix `user-detail-direct.tsx`
- Change `getUserDirect` → `getUserDataOps` (match Pattern C)
- Update header: "Server → data-ops (Direct)"
- Replace local state with URL search params (match update demo)
- Import centralized `userDetailQueryOptions`

### Step 3: Standardize `user-update-direct.tsx`
- Import centralized `userDetailQueryOptions`
- Remove local definition

### Step 4: Add SSR to `user-delete-direct.tsx`
- Add loader with `ensureQueryData`
- Add `placeholderData` to query
- Use centralized query options
- Remove back link
- Update index to show SSR ✓

### Step 5: Update Index
- Fix `user-detail-direct` description to match Pattern C
- Update delete demo SSR status

---

## File Changes Summary

| File | Changes |
|------|---------|
| `query-keys.ts` | Add userDetailQueryOptions, usersListDataOpsQueryOptions |
| `user-detail-direct.tsx` | Fix data source, add search params, use centralized options |
| `user-update-direct.tsx` | Use centralized query options |
| `user-delete-direct.tsx` | Add SSR loader, placeholderData, remove back link |
| `index.tsx` | Update descriptions/SSR status |

---

## Decisions

1. ~~Keep `getUserDirect`~~ → Remove if unused
2. ~~Client-only delete~~ → Use SSR
3. ~~Local state~~ → Use shareable URLs
