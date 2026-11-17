import { emptyState, mergeDiary, validState } from "./diary-data.js";
export function createDiarySync({
  getState,
  applyState,
  onStatus,
  canApply = () => true,
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
}) {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let base = emptyState(),
    revision = 0,
    running = false,
    again = false,
    conflict = null,
    timer;
  try {
    const cached = JSON.parse(storage.getItem("nutriar-cloud-v1"));
    if (
      cached &&
      validState(cached.base) &&
      Number.isSafeInteger(cached.revision)
    ) {
      base = cached.base;
      revision = cached.revision;
    }
  } catch {}
  function remember() {
    try {
      storage.setItem("nutriar-cloud-v1", JSON.stringify({ base, revision }));
    } catch {}
  }
  const status = (kind, message) => onStatus(kind, message);
  async function request(method, body) {
    const response = await fetchImpl("/api/diary", {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (!response.ok && response.status !== 409) {
      const error = new Error("Cloud unavailable");
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    if (
      !Number.isSafeInteger(data.revision) ||
      data.revision < 0 ||
      (data.state !== null && !validState(data.state))
    )
      throw new Error("Invalid cloud response");
    return { ...data, conflict: response.status === 409 };
  }
  function reconcile(remote) {
    if (!canApply()) {
      status("saving", "Saved on this device · sync resumes after editing");
      return false;
    }
    const result = mergeDiary(base, getState(), remote.state || emptyState());
    if (result.conflicts.length) {
      conflict = remote;
      status(
        "conflict",
        "Saved on this device · review changes from another device",
      );
      return false;
    }
    base = clone(remote.state || emptyState());
    revision = remote.revision;
    applyState(result.state);
    remember();
    return true;
  }
  async function sync() {
    clearTimeout(timer);
    if (running) {
      again = true;
      return;
    }
    if (conflict) {
      status(
        "conflict",
        "Saved on this device · review changes from another device",
      );
      return;
    }
    running = true;
    again = false;
    status("saving", "Saved on this device · syncing…");
    try {
      if (!reconcile(await request("GET"))) return;
      // Retry only optimistic concurrency races, never blindly replace another device.
      for (let attempt = 0; attempt < 3; attempt++) {
        const snapshot = clone(getState());
        if (JSON.stringify(snapshot) === JSON.stringify(base)) {
          status("saved", "Saved on this device and in cloud");
          return;
        }
        const remote = await request("PUT", { revision, state: snapshot });
        if (remote.conflict) {
          if (!reconcile(remote)) return;
          continue;
        }
        base = clone(snapshot);
        revision = remote.revision;
        remember();
        if (JSON.stringify(getState()) === JSON.stringify(snapshot)) {
          status("saved", "Saved on this device and in cloud");
          return;
        }
      }
      status("offline", "Saved on this device · cloud changes pending");
    } catch (error) {
      status(
        error.status === 401
          ? "auth"
          : error.status === 503
            ? "setup"
            : "offline",
        error.status === 401
          ? "Saved on this device · sign in for cloud saving"
          : error.status === 503
            ? "Saved on this device · cloud database not connected"
            : "Saved on this device · cloud sync pending; retry when connected",
      );
    } finally {
      running = false;
      if (again && !conflict) {
        again = false;
        timer = setTimeout(sync, 400);
      }
    }
  }
  return {
    sync,
    changed() {
      if (conflict) return;
      status("saving", "Saved on this device · cloud changes pending");
      clearTimeout(timer);
      timer = setTimeout(sync, 400);
    },
    resolve(source) {
      if (!conflict) return;
      base = clone(conflict.state || emptyState());
      revision = conflict.revision;
      if (source === "cloud") applyState(clone(base));
      conflict = null;
      remember();
      sync();
    },
  };
}
