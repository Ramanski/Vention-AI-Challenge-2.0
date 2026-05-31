const EMPTY_RESULT = {
  critical_dependency_chain: [],
  total_elapsed_duration_minutes: 0,
  chain_start_time_minutes: null,
  chain_completion_time_minutes: null,
  dependency_buffers_applied_minutes: 0,
};

function operationStart(flight) {
  return Math.min(flight.schedule.operation_time, flight.schedule.gate_window[0]);
}

export function analyzeBottleneck(state) {
  const scheduled = [...state.flights.values()].filter((flight) => flight.status === "scheduled");
  if (!scheduled.length) return { ...EMPTY_RESULT };

  const memo = new Map();
  const elapsed = (chain) =>
    state.flights.get(chain.at(-1)).schedule.completed_at - operationStart(state.flights.get(chain[0]));
  const compare = (left, right) =>
    elapsed(right) - elapsed(left) || right.length - left.length || left.join(",").localeCompare(right.join(","));
  const comparePrefixes = (left, right) =>
    operationStart(state.flights.get(left[0])) - operationStart(state.flights.get(right[0])) || compare(left, right);
  const chain = (flight) => {
    if (memo.has(flight.flight_number)) return memo.get(flight.flight_number);
    const dependencies = flight.dependencies
      .map((number) => state.flights.get(number))
      .filter((item) => item?.status === "scheduled");
    const prefix = dependencies.map(chain).sort(comparePrefixes)[0] ?? [];
    const result = [...prefix, flight.flight_number];
    memo.set(flight.flight_number, result);
    return result;
  };

  const critical = scheduled.map(chain).filter((item) => item.length > 1).sort(compare)[0];
  if (!critical) return { ...EMPTY_RESULT };
  const dependencyWait = critical.slice(1).reduce((total, number, index) => {
    const previous = state.flights.get(critical[index]);
    const current = state.flights.get(number);
    return total + Math.max(0, operationStart(current) - previous.schedule.completed_at);
  }, 0);
  return {
    critical_dependency_chain: critical,
    total_elapsed_duration_minutes: elapsed(critical),
    chain_start_time_minutes: operationStart(state.flights.get(critical[0])),
    chain_completion_time_minutes: state.flights.get(critical.at(-1)).schedule.completed_at,
    dependency_buffers_applied_minutes: dependencyWait,
  };
}
