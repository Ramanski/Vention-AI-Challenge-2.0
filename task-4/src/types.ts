export type FlightStatus = "queued" | "scheduled" | "unscheduled" | "cancelled";

export type Priority = "high" | "medium" | "low";

export type OperationType = "arrival" | "departure";

export interface RunwayRequirements {
  allowed_runways?: number[];
  minimum_length_meters?: number;
}

export interface ScheduledOperation {
  flight_number: string;
  operation_type: OperationType;
  runway: number;
  gate: number;
  ground_crew: number;
  operation_time: number;
  gate_window: [number, number];
  completed_at: number;
}

export interface Flight {
  flight_number: string;
  operation_type: OperationType;
  priority: Priority;
  submission_sequence: number;
  dependencies: string[];
  runway_requirements: RunwayRequirements | null;
  status: FlightStatus;
  schedule: Omit<ScheduledOperation, "flight_number" | "operation_type"> | null;
  reason: string | null;
  reason_code: string | null;
}

export interface AirportConfig {
  runwayCount: number;
  gateCount: number;
  groundCrewCount: number;
  takeoffSeparation: number;
  landingSeparation: number;
  mixedSeparation: number;
  gateTurnaround: number;
  dependencyBuffer: number;
  maxHorizon: number;
  runwayLengths: number[];
}

export interface Runway {
  runway: number;
  length_meters: number;
  operations: ScheduledOperation[];
}

export interface GateServiceWindow {
  flight_number: string;
  window: [number, number];
}

export interface Gate {
  gate: number;
  service_windows: GateServiceWindow[];
}

export interface GroundCrew {
  ground_crew: number;
  service_windows: GateServiceWindow[];
}

export interface FlightCountsByState {
  scheduled: number;
  unscheduled: number;
  cancelled: number;
}

export interface FlightCountsByOperationType extends FlightCountsByState {
  total: number;
}

export interface UnscheduledFlight {
  flight_number: string;
  operation_type: OperationType;
  priority: Priority;
  dependencies: string[];
  reason: string | null;
  reason_code: string | null;
}

export interface AirportState {
  flights: Flight[];
  runways: Runway[];
  gates: Gate[];
  ground_crews: GroundCrew[];
  timeline: ScheduledOperation[];
  flight_counts: {
    total: number;
    by_state: FlightCountsByState;
    by_operation_type: Record<OperationType, FlightCountsByOperationType>;
  };
  resource_constraints: {
    has_unscheduled_flights: boolean;
    scheduling_horizon_reached: boolean;
    has_runway_capability_blocks: boolean;
    has_dependency_blocks: boolean;
    all_runways_used: boolean;
    all_gates_used: boolean;
    all_ground_crews_used: boolean;
  };
  unscheduled_flights: UnscheduledFlight[];
  schedule_completion_time_minutes: number | null;
}
