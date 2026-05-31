import type { AirportConfig } from "./types.js";

type Env = Record<string, string | undefined>;

const ENV_FIELDS = {
  runwayCount: ["RUNWAY_COUNT", "AIRPORT_RUNWAY_COUNT"],
  gateCount: ["GATE_COUNT", "AIRPORT_GATE_COUNT"],
  groundCrewCount: ["GROUND_CREW_COUNT", "AIRPORT_GROUND_CREW_COUNT"],
  takeoffSeparation: ["TAKEOFF_SEPARATION_MINUTES", "AIRPORT_TAKEOFF_SEPARATION_MINUTES"],
  landingSeparation: ["LANDING_SEPARATION_MINUTES", "AIRPORT_LANDING_SEPARATION_MINUTES"],
  mixedSeparation: ["MIXED_SEPARATION_MINUTES", "AIRPORT_MIXED_SEPARATION_MINUTES"],
  gateTurnaround: ["GATE_TURNAROUND_MINUTES", "AIRPORT_GATE_TURNAROUND_MINUTES"],
  dependencyBuffer: ["DEPENDENCY_BUFFER_MINUTES", "AIRPORT_DEPENDENCY_BUFFER_MINUTES"],
  maxHorizon: ["MAX_SCHEDULING_HORIZON_MINUTES", "AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES"],
} as const;

const RUNWAY_LENGTHS_NAMES = ["RUNWAY_LENGTHS", "AIRPORT_RUNWAY_LENGTHS_METERS"] as const;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function readEnv(env: Env, names: readonly string[]): { name: string; value: string } {
  const name = names.find((candidate) => env[candidate] !== undefined);
  if (!name) throw new ConfigError(`Missing required environment variable: ${names[0]}`);
  return { name, value: env[name] as string };
}

function parsePositiveInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${name} must be a positive integer`);
  }
  return parsed;
}

export function configFromEnv(env: Env = process.env): AirportConfig {
  const config = {} as Omit<AirportConfig, "runwayLengths">;
  for (const [field, names] of Object.entries(ENV_FIELDS)) {
    const { name, value } = readEnv(env, names);
    config[field as keyof typeof config] = parsePositiveInteger(name, value);
  }

  const { name, value } = readEnv(env, RUNWAY_LENGTHS_NAMES);
  const runwayLengths = value.split(",").map((item, index) =>
    parsePositiveInteger(`${name}[${index}]`, item.trim()),
  );
  if (runwayLengths.length !== config.runwayCount) {
    throw new ConfigError(`${name} must contain exactly RUNWAY_COUNT (${config.runwayCount}) values`);
  }

  return { ...config, runwayLengths };
}

export const loadConfig = configFromEnv;
