import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Airport } from "../src/airport.js";
import { analyzeBottleneck } from "../src/bottleneck.js";
import { ConfigError, configFromEnv } from "../src/config.js";
import { generateSchedule } from "../src/scheduler.js";
import { createServer } from "../src/index.js";
import {
  airportState,
  cancelFlight as cancelStateFlight,
  createStateManager,
  getFlights,
  replaceSchedule,
  resetState,
  submitFlight as submitStateFlight,
} from "../src/state.js";

const config = (overrides = {}) => ({
  runwayCount: 2, gateCount: 2, groundCrewCount: 2, takeoffSeparation: 3, landingSeparation: 4,
  mixedSeparation: 5, gateTurnaround: 10, dependencyBuffer: 2, maxHorizon: 120, runwayLengths: [2500, 3500], ...overrides,
});
const configuredEnv = () => ({
  ...process.env,
  AIRPORT_RUNWAY_COUNT: "2", AIRPORT_GATE_COUNT: "2", AIRPORT_GROUND_CREW_COUNT: "2",
  AIRPORT_TAKEOFF_SEPARATION_MINUTES: "3", AIRPORT_LANDING_SEPARATION_MINUTES: "4",
  AIRPORT_MIXED_SEPARATION_MINUTES: "5", AIRPORT_GATE_TURNAROUND_MINUTES: "10",
  AIRPORT_DEPENDENCY_BUFFER_MINUTES: "2", AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES: "120",
  AIRPORT_RUNWAY_LENGTHS_METERS: "2500,3500",
});
const flight = (flight_number) => ({
  flight_number,
  operation_type: "arrival",
  priority: "medium",
  dependencies: [],
  runway_requirements: null,
  status: "unscheduled",
  schedule: null,
  reason: null,
  reason_code: null,
});

test("state manager stores flights, schedule, and submission sequence", () => {
  const manager = createStateManager();
  assert.equal(manager.submitFlight(flight("A1")).submission_sequence, 0);
  assert.equal(manager.submitFlight(flight("A2")).submission_sequence, 1);
  assert.deepEqual(manager.getFlights().map((item) => item.flight_number), ["A1", "A2"]);
  assert.equal(manager.state.submissionSequence, 2);
  const schedule = [{ flight_number: "A1", operation_type: "arrival", runway: 1, gate: 1, ground_crew: 1, operation_time: 0, gate_window: [0, 10], completed_at: 10 }];
  assert.equal(manager.replaceSchedule(schedule), schedule);
  assert.equal(manager.state.schedule, schedule);
});

test("state manager cancels flights and resets state for tests", () => {
  const manager = createStateManager();
  manager.submitFlight(flight("A1"));
  assert.equal(manager.cancelFlight("A1").status, "cancelled");
  manager.replaceSchedule([{ flight_number: "A1" }]);
  manager.resetState();
  assert.deepEqual(manager.getFlights(), []);
  assert.deepEqual(manager.state.schedule, []);
  assert.equal(manager.state.submissionSequence, 0);
});

test("state module exports singleton helper functions", () => {
  resetState();
  submitStateFlight(flight("A1"));
  replaceSchedule([]);
  assert.equal(getFlights()[0].flight_number, "A1");
  assert.equal(cancelStateFlight("A1").status, "cancelled");
  assert.equal(airportState.submissionSequence, 1);
  resetState();
});

test("scheduler replaces stale schedule and returns a summary", () => {
  const manager = createStateManager();
  manager.submitFlight(flight("A1"));
  manager.state.schedule = [{ flight_number: "STALE" }];
  const result = generateSchedule(manager.state, config());
  assert.equal(result.schedule, manager.state.schedule);
  assert.deepEqual(result.schedule.map((event) => event.flight_number), ["A1"]);
  assert.deepEqual(result.summary, { scheduled: 1, unscheduled: 0, cancelled: 0, completion_time_minutes: 10 });
});

test("scheduler detects dependency cycles and blocks dependents of unsuitable flights", () => {
  const manager = createStateManager();
  manager.submitFlight({ ...flight("HEAVY"), runway_requirements: { minimum_length_meters: 4000 } });
  manager.submitFlight({ ...flight("BLOCKED"), dependencies: ["HEAVY"] });
  manager.submitFlight({ ...flight("CYCLE-A"), dependencies: ["CYCLE-B"] });
  manager.submitFlight({ ...flight("CYCLE-B"), dependencies: ["CYCLE-A"] });
  const result = generateSchedule(manager.state, config());
  assert.equal(result.summary.unscheduled, 4);
  assert.equal(manager.state.flights.get("HEAVY").reason_code, "no_suitable_runway");
  assert.equal(manager.state.flights.get("BLOCKED").reason_code, "unscheduled_dependency");
  assert.equal(manager.state.flights.get("CYCLE-A").reason_code, "dependency_cycle");
  assert.ok([...manager.state.flights.values()].every((item) => item.status !== "queued"));
});

test("bottleneck analyzer handles empty state and ignores independent flights", () => {
  const manager = createStateManager();
  assert.deepEqual(analyzeBottleneck(manager.state), {
    critical_dependency_chain: [],
    total_elapsed_duration_minutes: 0,
    chain_start_time_minutes: null,
    chain_completion_time_minutes: null,
    dependency_buffers_applied_minutes: 0,
  });
  manager.submitFlight(flight("A1"));
  generateSchedule(manager.state, config());
  assert.deepEqual(analyzeBottleneck(manager.state).critical_dependency_chain, []);
});

test("bottleneck analyzer returns the longest scheduled dependency chain from state", () => {
  const manager = createStateManager();
  manager.submitFlight(flight("IN-1"));
  manager.submitFlight({ ...flight("OUT-1"), operation_type: "departure", dependencies: ["IN-1"] });
  generateSchedule(manager.state, config());
  const result = analyzeBottleneck(manager.state);
  assert.deepEqual(result.critical_dependency_chain, ["IN-1", "OUT-1"]);
  assert.equal(result.total_elapsed_duration_minutes, 22);
  assert.equal(result.dependency_buffers_applied_minutes, 2);
});

test("schedules dependencies after inbound completion", () => {
  const airport = new Airport(config());
  airport.submitFlight({ flight_number: "in-1", operation_type: "arrival", priority: "medium" });
  airport.submitFlight({ flight_number: "out-1", operation_type: "departure", priority: "high", dependencies: ["in-1"] });
  airport.refreshSchedule();
  assert.ok(airport.flights.get("OUT-1").schedule.gate_window[0] >= airport.flights.get("IN-1").schedule.completed_at + 2);
  assert.deepEqual(airport.bottleneckAnalysis().critical_dependency_chain, ["IN-1", "OUT-1"]);
});

test("connecting flight starts after inbound completion and dependency buffer", () => {
  const airport = new Airport(config({ runwayCount: 1, gateCount: 1, groundCrewCount: 1, runwayLengths: [3500], dependencyBuffer: 7 }));
  airport.submitFlight({ flight_number: "INBOUND-1", operation_type: "arrival", priority: "medium" });
  airport.submitFlight({ flight_number: "OUTBOUND-1", operation_type: "departure", priority: "high", dependencies: ["INBOUND-1"] });
  airport.refreshSchedule();
  const inbound = airport.flights.get("INBOUND-1").schedule;
  const outbound = airport.flights.get("OUTBOUND-1").schedule;
  assert.deepEqual(airport.timeline.map((event) => event.flight_number), ["INBOUND-1", "OUTBOUND-1"]);
  assert.equal(inbound.completed_at, 10);
  assert.equal(outbound.gate_window[0], inbound.completed_at + 7);
  assert.equal(outbound.operation_time, 27);
});

test("uses multiple runways and honors requirements", () => {
  const airport = new Airport(config());
  airport.submitFlight({ flight_number: "A1", operation_type: "arrival", priority: "high", runway_requirements: { allowed_runways: [1] } });
  airport.submitFlight({ flight_number: "A2", operation_type: "arrival", priority: "high", runway_requirements: { allowed_runways: [2] } });
  airport.refreshSchedule();
  assert.equal(airport.flights.get("A1").schedule.runway, 1);
  assert.equal(airport.flights.get("A2").schedule.runway, 2);
  assert.equal(airport.flights.get("A2").schedule.operation_time, 0);
});

test("heavy hauler remains unscheduled when no runway is long enough", () => {
  const airport = new Airport(config());
  airport.submitFlight({ flight_number: "HEAVY-1", operation_type: "departure", priority: "high", runway_requirements: { minimum_length_meters: 4000 } });
  airport.submitFlight({ flight_number: "VALID-1", operation_type: "arrival", priority: "medium", runway_requirements: { minimum_length_meters: 3000 } });
  const status = airport.refreshSchedule();
  assert.equal(airport.flights.get("HEAVY-1").status, "unscheduled");
  assert.equal(airport.flights.get("HEAVY-1").reason_code, "no_suitable_runway");
  assert.match(airport.flights.get("HEAVY-1").reason, /no suitable runway/);
  assert.equal(airport.flights.get("VALID-1").status, "scheduled");
  assert.equal(airport.flights.get("VALID-1").schedule.runway, 2);
  assert.equal(status.unscheduled_flights[0].flight_number, "HEAVY-1");
  assert.equal(status.resource_constraints.has_runway_capability_blocks, true);
  assert.equal(airport.runwayState()[1].length_meters, 3500);
});

test("enforces same-runway mixed-operation separation", () => {
  const airport = new Airport(config({ runwayCount: 1 }));
  airport.submitFlight({ flight_number: "A1", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "D1", operation_type: "departure", priority: "high" });
  airport.refreshSchedule();
  assert.ok(airport.flights.get("D1").schedule.operation_time >= airport.flights.get("A1").schedule.operation_time + 5);
});

test("schedules higher-priority flights earlier when resources are constrained", () => {
  const airport = new Airport(config({ runwayCount: 1, gateCount: 1, groundCrewCount: 1 }));
  airport.submitFlight({ flight_number: "LOW-1", operation_type: "arrival", priority: "low" });
  airport.submitFlight({ flight_number: "HIGH-1", operation_type: "arrival", priority: "high" });
  airport.refreshSchedule();
  assert.equal(airport.flights.get("HIGH-1").schedule.operation_time, 0);
  assert.ok(airport.flights.get("LOW-1").schedule.operation_time > 0);
});

test("does not overlap gate windows and produces deterministic refreshes", () => {
  const airport = new Airport(config({ gateCount: 1, groundCrewCount: 1 }));
  airport.submitFlight({ flight_number: "A1", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "A2", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "D1", operation_type: "departure", priority: "medium" });
  airport.refreshSchedule();
  const first = JSON.stringify(airport.timeline);
  const windows = airport.timeline.map((event) => event.gate_window).sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < windows.length; index += 1) assert.ok(windows[index][0] >= windows[index - 1][1]);
  airport.refreshSchedule();
  assert.equal(JSON.stringify(airport.timeline), first);
});

test("morning rush schedules mixed operations by priority without overlaps", () => {
  const airport = new Airport(config({ runwayCount: 1, gateCount: 1, groundCrewCount: 1 }));
  airport.submitFlight({ flight_number: "ARR-HIGH", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "DEP-MED", operation_type: "departure", priority: "medium" });
  airport.submitFlight({ flight_number: "ARR-LOW", operation_type: "arrival", priority: "low" });
  airport.submitFlight({ flight_number: "DEP-LOW", operation_type: "departure", priority: "low" });
  const status = airport.refreshSchedule();
  assert.deepEqual(airport.timeline.map((event) => event.flight_number), ["ARR-HIGH", "DEP-MED", "ARR-LOW", "DEP-LOW"]);
  assert.deepEqual(status.flight_counts.by_state, { scheduled: 4, unscheduled: 0, cancelled: 0 });
  const windows = airport.timeline.map((event) => event.gate_window);
  for (let index = 1; index < windows.length; index += 1) assert.ok(windows[index][0] >= windows[index - 1][1]);
  for (let index = 1; index < airport.timeline.length; index += 1) {
    const previous = airport.timeline[index - 1];
    const current = airport.timeline[index];
    assert.ok(current.operation_time >= previous.operation_time + airport.separation(previous.operation_type, current.operation_type));
  }
});

test("cancellation blocks dependent flights and reschedules others", () => {
  const airport = new Airport(config());
  airport.submitFlight({ flight_number: "A1", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "D1", operation_type: "departure", priority: "high", dependencies: ["A1"] });
  airport.submitFlight({ flight_number: "D2", operation_type: "departure", priority: "low", dependencies: ["D1"] });
  airport.submitFlight({ flight_number: "A2", operation_type: "arrival", priority: "medium" });
  airport.refreshSchedule();
  assert.deepEqual(airport.cancelFlight({ flight_number: "A1" }).affected_dependents, ["D1", "D2"]);
  assert.match(airport.flights.get("D1").reason, /cancelled/);
  assert.equal(airport.flights.get("A2").status, "scheduled");
});

test("leaves unknown dependencies, cycles, and horizon overflow unscheduled", () => {
  const airport = new Airport(config({ maxHorizon: 5 }));
  airport.submitFlight({ flight_number: "A1", operation_type: "arrival", priority: "high", dependencies: ["MISSING"] });
  airport.submitFlight({ flight_number: "A2", operation_type: "arrival", priority: "high", dependencies: ["A3"] });
  airport.submitFlight({ flight_number: "A3", operation_type: "arrival", priority: "high", dependencies: ["A2"] });
  airport.submitFlight({ flight_number: "D1", operation_type: "departure", priority: "high" });
  airport.refreshSchedule();
  assert.match(airport.flights.get("A1").reason, /unknown/);
  assert.match(airport.flights.get("A2").reason, /cycle/);
  assert.match(airport.flights.get("D1").reason, /horizon/);
});

test("returns structured operational status with constraints and blocked flights", () => {
  const airport = new Airport(config());
  airport.submitFlight({ flight_number: "A1", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "D1", operation_type: "departure", priority: "low", dependencies: ["MISSING"] });
  const status = airport.refreshSchedule();
  assert.deepEqual(status.flight_counts.by_state, { scheduled: 1, unscheduled: 1, cancelled: 0 });
  assert.equal(status.flight_counts.by_operation_type.arrival.scheduled, 1);
  assert.equal(status.flight_counts.by_operation_type.departure.unscheduled, 1);
  assert.equal(status.resource_usage.runways.total, 2);
  assert.equal(status.resource_usage.gates.usage[0].service_windows[0].flight_number, "A1");
  assert.equal(status.resource_constraints.has_dependency_blocks, true);
  assert.equal(status.unscheduled_flights[0].reason_code, "unknown_dependency");
  assert.equal(status.schedule_completion_time_minutes, 10);
});

test("bottleneck analysis returns the longest active dependency chain, not the latest independent flight", () => {
  const airport = new Airport(config({ runwayCount: 1, gateCount: 1, groundCrewCount: 1 }));
  airport.submitFlight({ flight_number: "A1", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "D1", operation_type: "departure", priority: "high", dependencies: ["A1"] });
  airport.submitFlight({ flight_number: "D2", operation_type: "departure", priority: "low" });
  airport.refreshSchedule();
  const analysis = airport.bottleneckAnalysis();
  assert.deepEqual(analysis.critical_dependency_chain, ["A1", "D1"]);
  assert.equal(analysis.total_elapsed_duration_minutes, 22);
  assert.equal(analysis.dependency_buffers_applied_minutes, 2);
});

test("bottleneck analysis chooses the earliest branch when dependencies converge", () => {
  const airport = new Airport(config({ runwayCount: 1, gateCount: 1, groundCrewCount: 1 }));
  airport.submitFlight({ flight_number: "EARLY", operation_type: "arrival", priority: "high" });
  airport.submitFlight({ flight_number: "LATE", operation_type: "arrival", priority: "medium" });
  airport.submitFlight({ flight_number: "MERGE", operation_type: "departure", priority: "low", dependencies: ["EARLY", "LATE"] });
  airport.refreshSchedule();
  assert.deepEqual(airport.bottleneckAnalysis().critical_dependency_chain, ["EARLY", "MERGE"]);
});

test("MCP dispatcher lists and calls tools", () => {
  const server = createServer(new Airport(config()));
  assert.equal(server.dispatch({ jsonrpc: "2.0", id: 1, method: "tools/list" }).result.tools.length, 5);
  const response = server.dispatch({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "submit_flight", arguments: { flight_number: "A1", operation_type: "arrival", priority: "low" } } });
  assert.equal(response.result.structuredContent.data.flight_number, "A1");
});

test("MCP dispatcher exposes all airport resources", () => {
  const server = createServer(new Airport(config()));
  const listed = server.dispatch({ jsonrpc: "2.0", id: 1, method: "resources/list" }).result.resources;
  assert.deepEqual(listed.map((resource) => resource.uri), ["airport://flight-queue", "airport://runways", "airport://timeline"]);
  for (const resource of listed) {
    const response = server.dispatch({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: resource.uri } });
    assert.equal(response.result.contents[0].uri, resource.uri);
  }
});

test("MCP tools expose generated schemas and structured validation errors", () => {
  const server = createServer(new Airport(config()));
  const listed = server.dispatch({ jsonrpc: "2.0", id: 1, method: "tools/list" }).result.tools;
  assert.deepEqual(listed.map((tool) => tool.name), ["submit_flight", "generate_schedule", "get_airport_status", "cancel_flight", "analyze_bottleneck"]);
  assert.equal(listed[0].inputSchema.properties.flight_number.type, "string");
  const response = server.dispatch({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "submit_flight", arguments: { flight_number: "", operation_type: "arrival", priority: "urgent" } } });
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.error.code, "INVALID_TOOL_INPUT");
  assert.ok(response.result.structuredContent.error.details.some((issue) => issue.path === "flight_number"));
});

test("MCP tools return structured domain errors", () => {
  const server = createServer(new Airport(config()));
  const request = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "submit_flight", arguments: { flight_number: "A1", operation_type: "arrival", priority: "high" } } };
  server.dispatch(request);
  const response = server.dispatch(request);
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.error.code, "TOOL_EXECUTION_ERROR");
  assert.match(response.result.structuredContent.error.message, /already exists/);
});

test("stdio entrypoint initializes with configured environment", () => {
  const request = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  const result = spawnSync(process.execPath, ["src/index.js"], { env: configuredEnv(), input: `${request}\n`, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).result.protocolVersion, "2025-11-25");
});

test("stdio client can submit, schedule, inspect status, and analyze bottlenecks", () => {
  const requests = [
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "submit_flight", arguments: { flight_number: "IN-1", operation_type: "arrival", priority: "high" } } },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "submit_flight", arguments: { flight_number: "OUT-1", operation_type: "departure", priority: "medium", dependencies: ["IN-1"] } } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "generate_schedule", arguments: {} } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_airport_status", arguments: {} } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "analyze_bottleneck", arguments: {} } },
    { jsonrpc: "2.0", id: 6, method: "resources/read", params: { uri: "airport://timeline" } },
    { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "cancel_flight", arguments: { flight_number: "IN-1" } } },
  ];
  const result = spawnSync(process.execPath, ["src/index.js"], { env: configuredEnv(), input: `${requests.map(JSON.stringify).join("\n")}\n`, encoding: "utf8" });
  const responses = result.stdout.trim().split("\n").map(JSON.parse);
  assert.equal(result.status, 0);
  assert.equal(responses[3].result.structuredContent.data.flight_counts.by_state.scheduled, 2);
  assert.deepEqual(responses[4].result.structuredContent.data.critical_dependency_chain, ["IN-1", "OUT-1"]);
  assert.equal(JSON.parse(responses[5].result.contents[0].text).length, 2);
  assert.equal(responses[6].result.structuredContent.data.cancelled, "IN-1");
});

test("configuration fails clearly when required values are absent or invalid", () => {
  assert.throws(() => configFromEnv({}), ConfigError);
  assert.throws(() => configFromEnv({
    AIRPORT_RUNWAY_COUNT: "zero", AIRPORT_GATE_COUNT: "2", AIRPORT_GROUND_CREW_COUNT: "2",
    AIRPORT_TAKEOFF_SEPARATION_MINUTES: "3", AIRPORT_LANDING_SEPARATION_MINUTES: "4",
    AIRPORT_MIXED_SEPARATION_MINUTES: "5", AIRPORT_GATE_TURNAROUND_MINUTES: "10",
    AIRPORT_DEPENDENCY_BUFFER_MINUTES: "2", AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES: "120",
    AIRPORT_RUNWAY_LENGTHS_METERS: "2500,3500",
  }), /AIRPORT_RUNWAY_COUNT must be a positive integer/);
  assert.throws(() => configFromEnv({
    ...configuredEnv(),
    AIRPORT_GATE_COUNT: "0",
  }), /AIRPORT_GATE_COUNT must be a positive integer/);
  assert.throws(() => configFromEnv({
    ...configuredEnv(),
    AIRPORT_RUNWAY_LENGTHS_METERS: "2500",
  }), /must contain exactly RUNWAY_COUNT \(2\) values/);
});

test("configuration loader supports concise environment names", () => {
  const loaded = configFromEnv({
    RUNWAY_COUNT: "2", GATE_COUNT: "3", GROUND_CREW_COUNT: "4",
    TAKEOFF_SEPARATION_MINUTES: "3", LANDING_SEPARATION_MINUTES: "4",
    MIXED_SEPARATION_MINUTES: "5", GATE_TURNAROUND_MINUTES: "10",
    DEPENDENCY_BUFFER_MINUTES: "2", MAX_SCHEDULING_HORIZON_MINUTES: "120",
    RUNWAY_LENGTHS: "2500,3500",
  });
  assert.equal(loaded.runwayCount, 2);
  assert.deepEqual(loaded.runwayLengths, [2500, 3500]);
});
