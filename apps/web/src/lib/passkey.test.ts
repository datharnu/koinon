import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createPasskey, PasskeyError, passkeyPrfOffered, unlockWithPasskey } from "./passkey";

type Caps = Record<string, boolean> | undefined;

const rawId = new Uint8Array(16).fill(7);
const prfBytes = new Uint8Array(32).fill(9);

let lastCreate: PublicKeyCredentialCreationOptions | undefined;
let lastGet: PublicKeyCredentialRequestOptions | undefined;
let getCalls = 0;

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function install(options: { createPrf?: boolean; createEnabled?: boolean; getPrf?: boolean; caps?: Caps }) {
  lastCreate = undefined;
  lastGet = undefined;
  getCalls = 0;

  const PublicKeyCredential = Object.assign(function PublicKeyCredential() {}, {
    getClientCapabilities: options.caps === undefined ? undefined : async () => options.caps,
  });

  const window = {
    isSecureContext: true,
    location: { hostname: "localhost" },
    PublicKeyCredential,
  };

  Object.defineProperty(globalThis, "window", { value: window, configurable: true });
  Object.defineProperty(globalThis, "PublicKeyCredential", { value: PublicKeyCredential, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: {
      credentials: {
        create: async ({ publicKey }: { publicKey: PublicKeyCredentialCreationOptions }) => {
          lastCreate = publicKey;
          return {
            rawId: bufferOf(rawId),
            getClientExtensionResults: () => ({
              prf: {
                enabled: options.createEnabled,
                results: options.createPrf ? { first: bufferOf(prfBytes) } : undefined,
              },
            }),
          };
        },
        get: async ({ publicKey }: { publicKey: PublicKeyCredentialRequestOptions }) => {
          getCalls += 1;
          lastGet = publicKey;
          return {
            getClientExtensionResults: () => ({
              prf: options.getPrf ? { results: { first: bufferOf(prfBytes) } } : { enabled: false },
            }),
          };
        },
      },
    },
    configurable: true,
  });
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;
});

test("Safari / Android: create asks prf:{} then get() evals the salt", async () => {
  install({ getPrf: true });
  const made = await createPasskey("Kolda");
  assert.equal(lastCreate?.authenticatorSelection?.authenticatorAttachment, "platform");
  assert.deepEqual(lastCreate?.extensions, { prf: {} });
  assert.ok(lastGet?.extensions && "prf" in lastGet.extensions);
  const evalFirst = (lastGet?.extensions as { prf: { eval: { first: BufferSource } } }).prf.eval.first;
  assert.ok(evalFirst instanceof ArrayBuffer);
  assert.equal(made.secret.length, 64);
  assert.equal(made.method.method, "passkey");
  assert.equal(getCalls, 1);
});

test("Chrome: PRF bytes at create skip a second ceremony", async () => {
  install({ createPrf: true, createEnabled: true });
  const made = await createPasskey("Kolda");
  assert.equal(getCalls, 0);
  assert.equal(made.secret, Buffer.from(prfBytes).toString("hex"));
});

test("Windows Hello: create with enabled:false falls back without a second prompt", async () => {
  install({ createEnabled: false });
  await assert.rejects(() => createPasskey("Kolda"), (error: unknown) => error instanceof PasskeyError && error.code === "NO_PRF");
  assert.equal(getCalls, 0);
});

test("get() without hmac-secret is NO_PRF", async () => {
  install({ getPrf: false });
  await assert.rejects(() => createPasskey("Kolda"), (error: unknown) => error instanceof PasskeyError && error.code === "NO_PRF");
});

test("unlock re-evals the stored salt", async () => {
  install({ getPrf: true });
  const made = await createPasskey("Kolda");
  assert.ok(made.method.method === "passkey");
  const secret = await unlockWithPasskey(made.method);
  assert.equal(secret, made.secret);
});

test("passkeyPrfOffered is false when the client says it cannot do PRF", async () => {
  install({ caps: { "extension:prf": false } });
  assert.equal(await passkeyPrfOffered(), false);
});

test("passkeyPrfOffered stays true when capabilities omit PRF", async () => {
  install({ caps: { conditionalGet: true } });
  assert.equal(await passkeyPrfOffered(), true);
});
