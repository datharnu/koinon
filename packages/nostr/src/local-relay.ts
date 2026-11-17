import { matchFilters, type Event, type Filter } from "nostr-tools";
import { WebSocket, WebSocketServer, type WebSocket as Socket } from "ws";

interface Subscription {
  socket: Socket;
  id: string;
  filters: Filter[];
}

/**
 * NIP-01 relay for the regtest demo, including compose. It stores events and answers REQ.
 * It does not authenticate publishers. That limit is stated in docs/NOSTR.md.
 */
export async function startLocalRelay(options?: { host?: string; port?: number }): Promise<{
  url: string;
  events: Event[];
  close: () => Promise<void>;
}> {
  const host = options?.host ?? "127.0.0.1";
  const server = new WebSocketServer({ host, port: options?.port ?? 0 });
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("relay did not bind");
  }
  const events: Event[] = [];
  const subscriptions: Subscription[] = [];
  server.on("connection", (socket) => {
    socket.on("message", (data) => {
      let frame: unknown;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!Array.isArray(frame) || frame.length < 2) return;
      const [type] = frame;
      if (type === "EVENT") {
        const event = frame[1] as Event;
        if (!event?.id || typeof event.content !== "string" || !Array.isArray(event.tags)) {
          socket.send(JSON.stringify(["OK", "", false, "invalid event"]));
          return;
        }
        if (!events.some((item) => item.id === event.id)) events.push(event);
        socket.send(JSON.stringify(["OK", event.id, true, ""]));
        for (const sub of subscriptions) {
          if (sub.socket.readyState === WebSocket.OPEN && matchFilters(sub.filters, event)) {
            sub.socket.send(JSON.stringify(["EVENT", sub.id, event]));
          }
        }
        return;
      }
      if (type === "REQ" && typeof frame[1] === "string") {
        const id = frame[1];
        const filters = frame.slice(2).filter((item) => item && typeof item === "object") as Filter[];
        subscriptions.push({ socket, id, filters });
        for (const event of events) {
          if (matchFilters(filters, event)) socket.send(JSON.stringify(["EVENT", id, event]));
        }
        socket.send(JSON.stringify(["EOSE", id]));
        return;
      }
      if (type === "CLOSE" && typeof frame[1] === "string") {
        const id = frame[1];
        for (let index = subscriptions.length - 1; index >= 0; index -= 1) {
          const sub = subscriptions[index];
          if (sub && sub.socket === socket && sub.id === id) subscriptions.splice(index, 1);
        }
      }
    });
    socket.on("close", () => {
      for (let index = subscriptions.length - 1; index >= 0; index -= 1) {
        if (subscriptions[index]?.socket === socket) subscriptions.splice(index, 1);
      }
    });
  });
  const advertised = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return {
    url: `ws://${advertised}:${address.port}`,
    events,
    close: () =>
      new Promise((resolve) => {
        for (const client of server.clients) client.close();
        server.close(() => resolve());
      }),
  };
}
