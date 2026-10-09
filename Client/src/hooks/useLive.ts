import { useSyncExternalStore } from "react";
import { getDb, subscribe } from "../services/api";

// Re-runs a read function from the service layer whenever stored data changes.
// Pages never see tables: they pass a service call such as `useLive(getOpenLoans)` and get view rows back.
//
// TEMPORARY MOCK: the subscription below listens to the in-browser mock database.
// BACKEND REPLACEMENT: when the Node.js API exists, replace this body with a fetch + refetch-after-mutation
// (or a small query library). The signature `useLive(select)` can stay, so pages do not change.
export function useLive<T>(select: () => T): T {
  useSyncExternalStore(subscribe, getDb);
  return select();
}