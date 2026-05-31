import * as z from "zod";
import type { Airport } from "../airport.js";

interface ToolServer {
  registerTool(name: string, description: string, inputSchema: Record<string, unknown>, handler: (args: unknown) => ToolResponse): void;
}

interface ToolResponse {
  isError?: boolean;
  structuredContent: unknown;
  content: Array<{ type: "text"; text: string }>;
}

const emptyInput = z.strictObject({});
const runwayRequirements = z.union([
  z.strictObject({ allowed_runways: z.array(z.int().positive()).min(1), minimum_length_meters: z.int().positive().optional() }),
  z.strictObject({ allowed_runways: z.array(z.int().positive()).min(1).optional(), minimum_length_meters: z.int().positive() }),
]);

export const toolDefinitions = [
  {
    name: "submit_flight",
    description: "Add an arrival or departure to the flight queue.",
    schema: z.strictObject({
      flight_number: z.string().trim().min(1), operation_type: z.enum(["arrival", "departure"]),
      priority: z.enum(["high", "medium", "low"]), dependencies: z.array(z.string().trim().min(1)).optional(),
      runway_requirements: runwayRequirements.optional(),
    }),
    execute: (airport: Airport, args: any) => airport.submitFlight(args),
  },
  {
    name: "generate_schedule", description: "Replace the current schedule with a freshly computed schedule.",
    schema: emptyInput, execute: (airport: Airport) => airport.refreshSchedule(),
  },
  {
    name: "get_airport_status", description: "Get structured operational airport status.",
    schema: emptyInput, execute: (airport: Airport) => airport.status(),
  },
  {
    name: "cancel_flight", description: "Cancel a flight, recursively block dependents, and refresh the schedule.",
    schema: z.strictObject({ flight_number: z.string().trim().min(1) }), execute: (airport: Airport, args: any) => airport.cancelFlight(args),
  },
  {
    name: "analyze_bottleneck", description: "Find the longest active scheduled dependency chain.",
    schema: emptyInput, execute: (airport: Airport) => airport.bottleneckAnalysis(),
  },
] as const;

function jsonResponse(payload: unknown, isError = false): ToolResponse {
  return { ...(isError ? { isError: true } : {}), structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function errorResponse(code: string, message: string, details?: unknown): ToolResponse {
  return jsonResponse({ ok: false, error: { code, message, ...(details ? { details } : {}) } }, true);
}

export function registerAirportTools(server: ToolServer, airport: Airport): void {
  for (const tool of toolDefinitions) {
    server.registerTool(tool.name, tool.description, z.toJSONSchema(tool.schema, { io: "input" }), (args) => {
      const parsed = tool.schema.safeParse(args);
      if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({ path: issue.path.length ? issue.path.join(".") : "$", message: issue.message, code: issue.code }));
        return errorResponse("INVALID_TOOL_INPUT", `Invalid input for ${tool.name}`, details);
      }
      try {
        return jsonResponse({ ok: true, data: tool.execute(airport, parsed.data as any) });
      } catch (error) {
        return errorResponse("TOOL_EXECUTION_ERROR", (error as Error).message);
      }
    });
  }
}
