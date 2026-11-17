import { Buffer } from "buffer";

// The shared packages also run in Node, where Buffer is a global. Must load before them.
(globalThis as { Buffer?: typeof Buffer }).Buffer ??= Buffer;
