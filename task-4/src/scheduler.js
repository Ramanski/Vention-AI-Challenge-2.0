const PRIORITIES = { high: 0, medium: 1, low: 2 };

export function separation(previous, current, config) {
  if (previous !== current) return config.mixedSeparation;
  return current === "departure" ? config.takeoffSeparation : config.landingSeparation;
}

function emptyRunways(config) {
  return new Map(Array.from({ length: config.runwayCount }, (_, index) => [index + 1, []]));
}

function suitableRunways(flight, runwayUsage, config) {
  const allowed = flight.runway_requirements?.allowed_runways ?? [...runwayUsage.keys()];
  const minimumLength = flight.runway_requirements?.minimum_length_meters ?? 0;
  return allowed.filter((runway) => config.runwayLengths[runway - 1] >= minimumLength);
}

function resourceSlot(resources, earliest) {
  let resource = 0;
  for (let index = 1; index < resources.length; index += 1) {
    if (Math.max(resources[index], earliest) < Math.max(resources[resource], earliest)) resource = index;
  }
  return { resource, start: Math.max(resources[resource], earliest) };
}

function runwaySlot(flight, earliest, runwayUsage, config) {
  return suitableRunways(flight, runwayUsage, config)
    .map((runway) => {
      const last = runwayUsage.get(runway).at(-1);
      const operation_time = last
        ? Math.max(earliest, last.operation_time + separation(last.operation_type, flight.operation_type, config))
        : earliest;
      return { runway, operation_time };
    })
    .sort((a, b) => a.operation_time - b.operation_time || a.runway - b.runway)[0];
}

function hasDependencyCycle(number, flights, visiting = new Set(), visited = new Set()) {
  if (visiting.has(number)) return true;
  if (visited.has(number) || !flights.has(number)) return false;
  visiting.add(number);
  for (const dependency of flights.get(number).dependencies) {
    if (hasDependencyCycle(dependency, flights, visiting, visited)) return true;
  }
  visiting.delete(number);
  visited.add(number);
  return false;
}

function blockFlight(flight, reason_code, reason) {
  flight.status = "unscheduled";
  flight.reason_code = reason_code;
  flight.reason = reason;
}

export function generateSchedule(state, config) {
  const runwayUsage = emptyRunways(config);
  const schedule = [];
  const gates = Array(config.gateCount).fill(0);
  const crews = Array(config.groundCrewCount).fill(0);
  const scheduled = new Set();

  for (const flight of state.flights.values()) {
    if (flight.status !== "cancelled") Object.assign(flight, { status: "queued", schedule: null, reason: null, reason_code: null });
  }
  const pending = new Set([...state.flights.values()].filter((flight) => flight.status === "queued").map((flight) => flight.flight_number));

  while (pending.size) {
    const ready = [...pending]
      .map((number) => state.flights.get(number))
      .filter((flight) => flight.dependencies.every((dependency) => scheduled.has(dependency)))
      .sort((a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority] || a.submission_sequence - b.submission_sequence);
    if (!ready.length) break;

    const flight = ready[0];
    pending.delete(flight.flight_number);
    if (!suitableRunways(flight, runwayUsage, config).length) {
      blockFlight(flight, "no_suitable_runway", "no suitable runway is available for the flight requirements");
      continue;
    }
    const dependencyReady = Math.max(0, ...flight.dependencies.map((number) => state.flights.get(number).schedule.completed_at + config.dependencyBuffer));
    let runway;
    let gate;
    let crew;
    let serviceStart;
    let completedAt;

    if (flight.operation_type === "departure") {
      gate = resourceSlot(gates, dependencyReady);
      crew = resourceSlot(crews, gate.start);
      serviceStart = Math.max(gate.start, crew.start);
      runway = runwaySlot(flight, serviceStart + config.gateTurnaround, runwayUsage, config);
      completedAt = runway.operation_time;
    } else {
      runway = runwaySlot(flight, dependencyReady, runwayUsage, config);
      gate = resourceSlot(gates, runway.operation_time);
      crew = resourceSlot(crews, gate.start);
      serviceStart = Math.max(gate.start, crew.start);
      completedAt = serviceStart + config.gateTurnaround;
    }

    if (completedAt > config.maxHorizon) {
      blockFlight(flight, "scheduling_horizon_exceeded", "exceeds maximum scheduling horizon");
      continue;
    }
    gates[gate.resource] = serviceStart + config.gateTurnaround;
    crews[crew.resource] = serviceStart + config.gateTurnaround;
    flight.status = "scheduled";
    flight.schedule = {
      runway: runway.runway,
      gate: gate.resource + 1,
      ground_crew: crew.resource + 1,
      operation_time: runway.operation_time,
      gate_window: [serviceStart, serviceStart + config.gateTurnaround],
      completed_at: completedAt,
    };
    const event = { flight_number: flight.flight_number, operation_type: flight.operation_type, ...flight.schedule };
    runwayUsage.get(runway.runway).push(event);
    schedule.push(event);
    scheduled.add(flight.flight_number);
  }

  for (const number of pending) {
    const flight = state.flights.get(number);
    const cancelled = flight.dependencies.filter((dependency) => state.flights.get(dependency)?.status === "cancelled");
    const unknown = flight.dependencies.filter((dependency) => !state.flights.has(dependency));
    const unscheduled = flight.dependencies.filter((dependency) => state.flights.get(dependency)?.status === "unscheduled");
    if (cancelled.length) blockFlight(flight, "cancelled_dependency", `blocked by cancelled dependencies: ${cancelled.join(", ")}`);
    else if (unknown.length) blockFlight(flight, "unknown_dependency", `waiting for unknown dependencies: ${unknown.join(", ")}`);
    else if (hasDependencyCycle(number, state.flights)) blockFlight(flight, "dependency_cycle", "dependency cycle detected");
    else blockFlight(flight, "unscheduled_dependency", `blocked by unscheduled dependencies: ${unscheduled.join(", ")}`);
  }

  schedule.sort((a, b) => a.operation_time - b.operation_time || a.flight_number.localeCompare(b.flight_number));
  state.schedule = schedule;
  return {
    schedule,
    runwayUsage,
    summary: {
      scheduled: scheduled.size,
      unscheduled: [...state.flights.values()].filter((flight) => flight.status === "unscheduled").length,
      cancelled: [...state.flights.values()].filter((flight) => flight.status === "cancelled").length,
      completion_time_minutes: schedule.length ? Math.max(...schedule.map((event) => event.completed_at)) : null,
    },
  };
}
