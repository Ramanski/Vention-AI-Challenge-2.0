export function createStateManager() {
  const state = {
    flights: new Map(),
    schedule: [],
    submissionSequence: 0,
  };

  return {
    state,
    submitFlight(flight) {
      if (state.flights.has(flight.flight_number)) {
        throw new Error(`Flight ${flight.flight_number} already exists`);
      }
      const submitted = { ...flight, submission_sequence: state.submissionSequence++ };
      state.flights.set(submitted.flight_number, submitted);
      return submitted;
    },
    cancelFlight(flightNumber) {
      const flight = state.flights.get(flightNumber);
      if (!flight) throw new Error(`Unknown flight ${flightNumber}`);
      flight.status = "cancelled";
      flight.schedule = null;
      flight.reason = "cancelled by operator";
      flight.reason_code = "cancelled";
      return flight;
    },
    getFlights() {
      return [...state.flights.values()];
    },
    replaceSchedule(schedule) {
      state.schedule = schedule;
      return state.schedule;
    },
    resetState() {
      state.flights.clear();
      state.schedule = [];
      state.submissionSequence = 0;
    },
  };
}

export const airportStateManager = createStateManager();
export const airportState = airportStateManager.state;
export const submitFlight = airportStateManager.submitFlight;
export const cancelFlight = airportStateManager.cancelFlight;
export const getFlights = airportStateManager.getFlights;
export const replaceSchedule = airportStateManager.replaceSchedule;
export const resetState = airportStateManager.resetState;
