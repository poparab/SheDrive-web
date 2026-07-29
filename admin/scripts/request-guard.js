/**
 * request-guard.js — SheDrive admin stale-response guard
 * Filter bars debounce and the mock API adds latency, so a slow earlier request
 * can resolve after a faster later one and overwrite the grid with stale rows.
 * Every list screen routes its loads through a guard so only the newest request
 * is allowed to touch the UI.
 *
 * Usage:
 *   const guard = createRequestGuard();
 *
 *   async function load() {
 *     const isCurrent = guard();
 *     table.setLoading();
 *     try {
 *       const result = await mockApi.listThings(query);
 *       if (!isCurrent()) return;          // superseded — drop it
 *       table.setData(result);
 *     } catch (error) {
 *       if (!isCurrent()) return;
 *       table.setError(error.message, load);
 *     }
 *   }
 */

export function createRequestGuard() {
  let sequence = 0;

  /** Call once per request; the returned predicate reports whether it is still the newest. */
  return function beginRequest() {
    const mine = ++sequence;
    return () => mine === sequence;
  };
}
