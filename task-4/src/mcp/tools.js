import * as z from "zod";

const emptyInput = z.strictObject({});
const runwayRequirements = z.union([
  z.strictObject({
    allowed_runways: z.array(z.int().positive()).min(1),
    minimum_length_meters: z.int().positive().optional(),
  }),
  z.strictObject({
    allowed_runways: z.array(z.int().positive()).min(1).optional(),
    minimum_length_meters: z.int().positive(),
  }),
]);

export const toolDefinitions = [
  {
    name: "submit_flight",
    description: "Add an arrival or departure to the flight queue.",
    schema: z.strictObject({
      flight_number: z.string().trim().min(1),
      operation_type: z.enum(["arrival", "departure"]),
      priority: z.enum(["high", "medium", "low"]),
      dependencies: z.array(z.string().trim().min(1)).optional(),
      runway_requirements: runwayRequirements.optional(),
    }),
    execute: (airport, args) => airport.submitFlight(args),
  },
  {
    name: "generate_schedule",
    description: "Replace the current schedule with a freshly computed schedule.",
    schema: emptyInput,
    execute: (airport) => airport.refreshSchedule(),
  },
  {
    name: "get_airport_status",
    description: "Get structured operational airport status.",
    schema: emptyInput,
    execute: (airport) => airport.status(),
  },
  {
    name: "cancel_flight",
    description: "Cancel a flight, recursively block dependents, and refresh the schedule.",
    schema: z.strictObject({ flight_number: z.string().trim().min(1) }),
    execute: (airport, args) => airport.cancelFlight(args),
  },
  {
    name: "analyze_bottleneck",
    description: "Find the longest active scheduled dependency chain.",
    schema: emptyInput,
    execute: (airport) => airport.bottleneckAnalysis(),
  },
];

function jsonResponse(payload, isError = false) {
  return {
    ...(isError ? { isError: true } : {}),
    structuredContent: payload,
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResponse(code, message, details = undefined) {
  return jsonResponse({ ok: false, error: { code, message, ...(details ? { details } : {}) } }, true);
}

function formatIssues(issues) {
  return issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "$",
    message: issue.message,
    code: issue.code,
  }));
}

export function registerAirportTools(server, airport) {
  for (const tool of toolDefinitions) {
    server.registerTool(tool.name, tool.description, z.toJSONSchema(tool.schema, { io: "input" }), (args) => {
      const parsed = tool.schema.safeParse(args);
      if (!parsed.success) {
        return errorResponse("INVALID_TOOL_INPUT", `Invalid input for ${tool.name}`, formatIssues(parsed.error.issues));
      }
      try {
        return jsonResponse({ ok: true, data: tool.execute(airport, parsed.data) });
      } catch (error) {
        return errorResponse("TOOL_EXECUTION_ERROR", error.message);
      }
    });
  }
}
