import { createServer } from "node:net";

const server = createServer((socket) => socket.end());

server.listen(0, "127.0.0.1", () => {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Tree fixture could not allocate a port");
  }

  process.send?.({ type: "listener-ready", pid: process.pid, port: address.port });
});
