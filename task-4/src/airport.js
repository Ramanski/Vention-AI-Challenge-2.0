import { createStateManager } from "./state.js";
import { generateSchedule, separation } from "./scheduler.js";
import { analyzeBottleneck } from "./bottleneck.js";

const PRIORITIES = { high: 0, medium: 1, low: 2 };

export class Airport {
  constructor(config, stateManager = createStateManager()) {
    this.config = config;
    this.stateManager = stateManager;
    this.flights = stateManager.state.flights;
    this.runwayUsage = this.emptyRunways();
    this.timeline = stateManager.state.schedule;
  }

  emptyRunways() {
    return new Map(Array.from({ length: this.config.runwayCount }, (_, index) => [index + 1, []]));
  }

  submitFlight({ flight_number, operation_type, priority, dependencies = [], runway_requirements = undefined }) {
    const number = flight_number?.trim().toUpperCase();
    if (!number) throw new Error("flight_number cannot be empty");
    if (!["arrival", "departure"].includes(operation_type)) throw new Error("operation_type must be arrival or departure");
    if (!(priority in PRIORITIES)) throw new Error("priority must be high, medium, or low");
    const deps = dependencies.map((item) => item.trim().toUpperCase());
    if (deps.includes(number)) throw new Error("A flight cannot depend on itself");
    if (new Set(deps).size !== deps.length) throw new Error("dependencies cannot contain duplicates");

    let allowedRunways;
    let minimumLengthMeters;
    if (runway_requirements) {
      allowedRunways = runway_requirements.allowed_runways;
      minimumLengthMeters = runway_requirements.minimum_length_meters;
      if (allowedRunways !== undefined) {
        if (!Array.isArray(allowedRunways) || !allowedRunways.length) {
          throw new Error("runway_requirements.allowed_runways must be a non-empty list");
        }
        if (allowedRunways.some((item) => !Number.isInteger(item) || !this.runwayUsage.has(item))) {
          throw new Error("allowed_runways must contain configured runway numbers");
        }
        allowedRunways = [...new Set(allowedRunways)].sort((a, b) => a - b);
      }
      if (minimumLengthMeters !== undefined && (!Number.isInteger(minimumLengthMeters) || minimumLengthMeters <= 0)) {
        throw new Error("runway_requirements.minimum_length_meters must be a positive integer");
      }
      if (allowedRunways === undefined && minimumLengthMeters === undefined) {
        throw new Error("runway_requirements must include allowed_runways or minimum_length_meters");
      }
    }

    const flight = {
      flight_number: number,
      operation_type,
      priority,
      dependencies: deps,
      runway_requirements: runway_requirements
        ? { ...(allowedRunways ? { allowed_runways: allowedRunways } : {}), ...(minimumLengthMeters ? { minimum_length_meters: minimumLengthMeters } : {}) }
        : null,
      status: "unscheduled",
      schedule: null,
      reason: null,
      reason_code: null,
    };
    return this.stateManager.submitFlight(flight);
  }

  dependentClosure(number) {
    const affected = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const flight of this.flights.values()) {
        if (!affected.has(flight.flight_number) && flight.dependencies.some((dep) => dep === number || affected.has(dep))) {
          affected.add(flight.flight_number);
          changed = true;
        }
      }
    }
    return [...affected].sort();
  }

  cancelFlight({ flight_number }) {
    const number = flight_number.trim().toUpperCase();
    this.stateManager.cancelFlight(number);
    const affected_dependents = this.dependentClosure(number);
    const schedule = this.refreshSchedule();
    return { cancelled: number, affected_dependents, schedule };
  }

  separation(previous, current) {
    return separation(previous, current, this.config);
  }

  refreshSchedule() {
    const result = generateSchedule(this.stateManager.state, this.config);
    this.runwayUsage = result.runwayUsage;
    this.timeline = result.schedule;
    return this.status();
  }

  status() {
    const by_state = { scheduled: 0, unscheduled: 0, cancelled: 0 };
    const by_operation_type = {
      arrival: { total: 0, scheduled: 0, unscheduled: 0, cancelled: 0 },
      departure: { total: 0, scheduled: 0, unscheduled: 0, cancelled: 0 },
    };
    for (const flight of this.flights.values()) {
      by_state[flight.status] += 1;
      by_operation_type[flight.operation_type].total += 1;
      by_operation_type[flight.operation_type][flight.status] += 1;
    }
    const runwayUsage = [...this.runwayUsage].map(([runway, operations]) => ({
      runway,
      length_meters: this.config.runwayLengths[runway - 1],
      operations_scheduled: operations.length,
      latest_operation_time_minutes: operations.at(-1)?.operation_time ?? null,
    }));
    const gateUsage = Array.from({ length: this.config.gateCount }, (_, index) => ({
      gate: index + 1,
      service_windows: this.timeline
        .filter((event) => event.gate === index + 1)
        .map((event) => ({ flight_number: event.flight_number, window: event.gate_window })),
    }));
    const crewUsage = Array.from({ length: this.config.groundCrewCount }, (_, index) => ({
      ground_crew: index + 1,
      service_windows: this.timeline
        .filter((event) => event.ground_crew === index + 1)
        .map((event) => ({ flight_number: event.flight_number, window: event.gate_window })),
    }));
    const unscheduled_flights = [...this.flights.values()]
      .filter((flight) => flight.status === "unscheduled")
      .map(({ flight_number, operation_type, priority, dependencies, reason, reason_code }) => ({
        flight_number, operation_type, priority, dependencies, reason, reason_code,
      }));
    const completion = this.timeline.length ? Math.max(...this.timeline.map((event) => event.completed_at)) : null;
    return {
      flight_counts: { total: this.flights.size, by_state, by_operation_type },
      resource_usage: {
        runways: {
          total: this.config.runwayCount,
          used: runwayUsage.filter((item) => item.operations_scheduled).length,
          usage: runwayUsage,
        },
        gates: {
          total: this.config.gateCount,
          used: gateUsage.filter((item) => item.service_windows.length).length,
          usage: gateUsage,
        },
        ground_crews: {
          total: this.config.groundCrewCount,
          used: crewUsage.filter((item) => item.service_windows.length).length,
          usage: crewUsage,
        },
      },
      resource_constraints: {
        has_unscheduled_flights: unscheduled_flights.length > 0,
        scheduling_horizon_reached: unscheduled_flights.some((flight) => flight.reason_code === "scheduling_horizon_exceeded"),
        has_runway_capability_blocks: unscheduled_flights.some((flight) => flight.reason_code === "no_suitable_runway"),
        has_dependency_blocks: unscheduled_flights.some((flight) => flight.reason_code?.includes("dependency")),
        all_runways_used: runwayUsage.length > 0 && runwayUsage.every((item) => item.operations_scheduled > 0),
        all_gates_used: gateUsage.length > 0 && gateUsage.every((item) => item.service_windows.length > 0),
        all_ground_crews_used: crewUsage.length > 0 && crewUsage.every((item) => item.service_windows.length > 0),
      },
      unscheduled_flights,
      schedule_completion_time_minutes: completion,
    };
  }

  bottleneckAnalysis() {
    return analyzeBottleneck(this.stateManager.state);
  }

  queue() {
    return [...this.flights.values()];
  }

  runwayState() {
    return [...this.runwayUsage].map(([runway, operations]) => ({
      runway,
      length_meters: this.config.runwayLengths[runway - 1],
      operations,
    }));
  }
}
