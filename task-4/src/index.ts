import readline from "node:readline";
import { Airport } from "./airport.js";
import { ConfigError, configFromEnv } from "./config.js";
import { registerAirportTools } from "./mcp/tools.js";
import { registerAirportResources } from "./mcp/resources.js";

type JsonSchema = Record<string, unknown>;
type ToolHandler = (args: unknown) => unknown;
type ResourceHandler = () => unknown;

interface JsonRpcRequest {
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export class McpServer {
  private tools = new Map<string, { definition: object; handler: ToolHandler }>();
  private resources = new Map<string, { definition: object; handler: ResourceHandler }>();

  constructor(private readonly serverInfo: { name: string; version: string }) {}

  registerTool(name: string, description: string, inputSchema: JsonSchema, handler: ToolHandler): void {
    this.tools.set(name, { definition: { name, description, inputSchema }, handler });
  }

  registerResource(uri: string, name: string, description: string, handler: ResourceHandler): void {
    this.resources.set(uri, { definition: { uri, name, description, mimeType: "application/json" }, handler });
  }

  dispatch(request: JsonRpcRequest): object | null {
    if (request.id === undefined) return null;
    const params = request.params ?? {};
    const methods: Record<string, () => unknown> = {
      initialize: () => ({
        protocolVersion: "2025-11-25", capabilities: { tools: {}, resources: {} }, serverInfo: this.serverInfo,
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
      return this.error(request.id, -32602, (error as Error).message);
    }
  }

  error(id: string | number | null, code: number, message: string): object {
    return { jsonrpc: "2.0", id, error: { code, message } };
  }

  private callTool(name: string, args: Record<string, unknown>): unknown {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool ${name}`);
    return tool.handler(args);
  }

  private readResource(uri: string): unknown {
    const resource = this.resources.get(uri);
    if (!resource) throw new Error(`Unknown resource ${uri}`);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(resource.handler(), null, 2) }] };
  }
}

export class StdioTransport {
  constructor(private readonly server: McpServer) {}

  start(): void {
    readline.createInterface({ input: process.stdin }).on("line", (line) => {
      if (!line.trim()) return;
      let response;
      try {
        response = this.server.dispatch(JSON.parse(line));
      } catch (error) {
        response = this.server.error(null, -32700, `Parse error: ${(error as Error).message}`);
      }
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    });
  }
}

export function createServer(airport: Airport): McpServer {
  const server = new McpServer({ name: "airport-atc", version: "1.0.0" });
  registerAirportTools(server, airport);
  registerAirportResources(server, airport);
  return server;
}

export function run(): void {
  try {
    new StdioTransport(createServer(new Airport(configFromEnv()))).start();
  } catch (error) {
    const label = error instanceof ConfigError ? "Airport configuration error" : "Startup error";
    console.error(`${label}: ${(error as Error).message}`);
    process.exitCode = 2;
  }
}

run();
