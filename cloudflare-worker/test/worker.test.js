import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function createEnv({ open = true, objectAvailable = true, initialValues = {} } = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    __values: values,
    BETA_OPEN: String(open),
    BETA_MAX_DOWNLOADS: "25",
    BETA_OBJECT_KEY: "UniqueFlowStudio_Full_Beta_0.9.0-rc1.exe",
    BETA_FILENAME: "UniqueFlowStudio_Full_Beta_0.9.0-rc1.exe",
    BETA_LINKS: {
      async get(key) { return values.get(key) ?? null; },
      async put(key, value) { values.set(key, value); }
    },
    BETA_FILES: {
      async get() {
        if (!objectAvailable) return null;
        return {
          body: new Uint8Array([1, 2, 3]),
          size: 3,
          range: { offset: 0, length: 3 },
          httpEtag: "test-etag",
          writeHttpMetadata(headers) { headers.set("content-type", "application/octet-stream"); }
        };
      }
    }
  };
}

test("status exposes beta state", async () => {
  const response = await worker.fetch(new Request("https://download.example/status"), createEnv());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { open: true, version: "0.9.0-rc1" });
});

test("closed beta refuses a download token", async () => {
  const response = await worker.fetch(new Request("https://download.example/download"), createEnv({ open: false }));
  assert.equal(response.status, 403);
});

test("full beta refuses new download tokens", async () => {
  const response = await worker.fetch(
    new Request("https://download.example/download"),
    createEnv({ initialValues: { "downloads:total": "25" } })
  );
  assert.equal(response.status, 403);
});

test("open beta creates a temporary token that serves the private file", async () => {
  const env = createEnv();
  const issued = await worker.fetch(new Request("https://download.example/download"), env);
  assert.equal(issued.status, 302);
  const location = issued.headers.get("location");
  assert.match(location, /^https:\/\/download\.example\/file\/[a-f0-9]{32}$/);

  const file = await worker.fetch(new Request(location), env);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-length"), "3");
  assert.match(file.headers.get("content-disposition"), /UniqueFlowStudio_Full_Beta_0\.9\.0-rc1\.exe/);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array([1, 2, 3]));
});

test("unknown or expired tokens are rejected", async () => {
  const response = await worker.fetch(
    new Request("https://download.example/file/0123456789abcdef0123456789abcdef"),
    createEnv()
  );
  assert.equal(response.status, 410);
});

test("HEAD checks do not consume a download", async () => {
  const env = createEnv();
  const issued = await worker.fetch(new Request("https://download.example/download"), env);
  const response = await worker.fetch(new Request(issued.headers.get("location"), { method: "HEAD" }), env);
  assert.equal(response.status, 200);
  assert.equal(env.__values.get("downloads:total"), undefined);
});

test("range requests return partial-content headers", async () => {
  const env = createEnv();
  const issued = await worker.fetch(new Request("https://download.example/download"), env);
  const response = await worker.fetch(
    new Request(issued.headers.get("location"), { headers: { range: "bytes=0-2" } }),
    env
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 0-2/3");
});
