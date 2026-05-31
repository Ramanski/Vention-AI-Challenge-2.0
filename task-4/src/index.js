import readline from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Airport } from "./airport.js";
import { ConfigError, configFromEnv } from "./config.js";
import { registerAirportTools } from "./mcp/tools.js";
import { registerAirportResources } from "./mcp/resources.js";

export class McpServer {
  constructor(serverInfo) {
    this.serverInfo = serverInfo;
    this.tools = new Map();
    this.resources = new Map();
  }

  registerTool(name, description, inputSchema, handler) {
    this.tools.set(name, { definition: { name, description, inputSchema }, handler });
  }

  registerResource(uri, name, description, handler) {
    this.resources.set(uri, { definition: { uri, name, description, mimeType: "application/json" }, handler });
  }

  content(payload) {
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }

  callTool(name, args) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool ${name}`);
    return tool.handler(args);
  }

  readResource(uri) {
    const resource = this.resources.get(uri);
    if (!resource) throw new Error(`Unknown resource ${uri}`);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(resource.handler(), null, 2) }] };
  }

  dispatch(request) {
    if (request.id === undefined) return null;
    const params = request.params ?? {};
    const methods = {
      initialize: () => ({
        protocolVersion: "2025-11-25",
        capabilities: { tools: {}, resources: {} },
        serverInfo: this.serverInfo,
        instructions: "Submit flights, then call generate_schedule before inspecting runway usage or the timeline.",
      }),
      ping: () => ({}),
      "tools/list": () => ({ tools: [...this.tools.values()].map((tool) => tool.definition) }),
      "tools/call": () => this.callTool(params.name, params.arguments ?? {}),
      "resources/list": () => ({ resources: [...this.resources.values()].map((resource) => resource.definition) }),
      "resources/read": () => this.readResource(params.uri),
    };
    if (!methods[request.method]) return this.error(request.id, -32601, `Method not found: ${request.method}`);
    try {
      return { jsonrpc: "2.0", id: request.id, result: methods[request.method]() };
    } catch (error) {
      return this.error(request.id, -32602, error.message);
    }
  }

  error(id, code, message) {
    return { jsonrpc: "2.0", id, error: { code, message } };
  }
}

export class StdioTransport {
  constructor(server) {
    this.server = server;
  }

  start() {
    readline.createInterface({ input: process.stdin }).on("line", (line) => {
      if (!line.trim()) return;
      let response;
      try {
        response = this.server.dispatch(JSON.parse(line));
      } catch (error) {
        response = this.server.error(null, -32700, `Parse error: ${error.message}`);
      }
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    });
  }
}

export function createServer(airport) {
  const server = new McpServer({ name: "airport-atc", version: "1.0.0" });
  registerAirportTools(server, airport);
  registerAirportResources(server, airport);
  return server;
}

export function run() {
  try {
    const airport = new Airport(configFromEnv());
    new StdioTransport(createServer(airport)).start();
  } catch (error) {
    const label = error instanceof ConfigError ? "Airport configuration error" : "Startup error";
    console.error(`${label}: ${error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
