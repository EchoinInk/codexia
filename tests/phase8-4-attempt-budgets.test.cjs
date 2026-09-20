const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, root } = require("./load-typescript.cjs");

const { TaskQueue } = load(path.join(root, "lib/agent/task-queue/queue.ts"));
const { InMemoryTaskQueueStore } = load(path.join(root, "lib/agent/task-queue/store.ts"));

const terminal = task => ["completed", "failed", "cancelled"].includes(task?.status);
async function waitFor(queue, id) {
  for (let i = 0; i < 200; i++) {
    const task = queue.get(id);
    if (terminal(task)) return task;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error("queue did not reach a terminal state");
}
function handlers(engineering) {
  const complete = async task => ({ summary: `${task.type} complete` });
  return { build: complete, tests: complete, lint: complete, documentation: complete,
    indexing: complete, engineering: engineering ?? complete };
}
function legacyTask(overrides = {}) {
  return { id: "bounded", type: "engineering", status: "running", priority: "normal", payload: {},
    attempt: 1, maxAttempts: 1, queuedAt: 1, updatedAt: 2, startedAt: 2, ...overrides };
}
function legacyStore(snapshot) {
  let current = structuredClone(snapshot);
  return { load: async () => structuredClone(current), save: async next => { current = structuredClone(next); } };
}

test("B10: a consumed final queue attempt remains exhausted after restart", async () => {
  let calls = 0;
  const queue = new TaskQueue("/workspace", handlers(async () => { calls++; return { summary: "unsafe" }; }),
    legacyStore({ version: 1, tasks: [legacyTask()], metrics: { queued: 0, running: 1, completed: 0, failed: 0, cancelled: 0, retries: 0 } }),
    { autoStart: true, retryDelayMs: 0 });
  await queue.initialize();
  assert.equal(queue.get("bounded").status, "failed");
  assert.deepEqual(queue.get("bounded").attemptBudget, { limit: 1, consumed: 1 });
  assert.equal(calls, 0);
});

test("B10: queue rehydration preserves a remaining attempt and consumes it once", async () => {
  let calls = 0;
  const queue = new TaskQueue("/workspace", handlers(async task => { calls++; assert.equal(task.attempt, 2); return { summary: "done" }; }),
    legacyStore({ version: 1, tasks: [legacyTask({ maxAttempts: 2 })], metrics: { queued: 0, running: 1, completed: 0, failed: 0, cancelled: 0, retries: 0 } }),
    { autoStart: true, retryDelayMs: 0 });
  await queue.initialize();
  const result = await waitFor(queue, "bounded");
  assert.equal(result.status, "completed");
  assert.equal(result.attemptBudget.consumed, 2);
  assert.equal(calls, 1);
});

test("B10: corrupt and incomplete legacy budget evidence fails closed", async () => {
  for (const task of [legacyTask({ attempt: undefined }), legacyTask({ attempt: -1 }), legacyTask({ attempt: 2 })]) {
    const queue = new TaskQueue("/workspace", handlers(), legacyStore({ version: 1, tasks: [task],
      metrics: { queued: 0, running: 1, completed: 0, failed: 0, cancelled: 0, retries: 0 } }));
    await assert.rejects(queue.initialize(), /budget evidence|corrupt/i);
  }
});

test("B10: pause/start, duplicate admission and concurrent starts cannot expand budget", async () => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const store = new InMemoryTaskQueueStore();
  const queue = new TaskQueue("/workspace", handlers(async () => { calls++; await held; return { summary: "done" }; }), store,
    { autoStart: false, concurrency: 2, retryDelayMs: 0 });
  await queue.initialize();
  await queue.enqueue({ id: "same", type: "engineering", maxAttempts: 1 });
  await assert.rejects(queue.enqueue({ id: "same", type: "engineering", maxAttempts: 3 }), /already exists/);
  queue.stop(); queue.start(); queue.start();
  for (let i = 0; i < 20 && queue.get("same").status !== "running"; i++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(queue.get("same").attemptBudget.consumed, 1);
  assert.equal(calls, 1);
  release();
  assert.equal((await waitFor(queue, "same")).attemptBudget.consumed, 1);
});

test("B10: engineering repair consumption occurs before the pre-execution checkpoint", () => {
  const runtime = fs.readFileSync(path.join(root, "lib/agent/engineering/runtime.ts"), "utf8");
  const workflow = fs.readFileSync(path.join(root, "lib/agent/engineering/workflow.ts"), "utf8");
  const consume = runtime.indexOf("task.attempts += 1");
  const marker = runtime.indexOf("session.inFlight =", consume);
  assert.ok(consume >= 0 && marker > consume);
  assert.doesNotMatch(workflow, /taskState\.attempts\+\+/);
  assert.match(runtime, /validatePersistedAttemptBudgets\(session\)/);
});
