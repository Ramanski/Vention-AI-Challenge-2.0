import type { Airport } from "../airport.js";

interface ResourceServer {
  registerResource(uri: string, name: string, description: string, handler: () => unknown): void;
}

export const resourceDefinitions = [
  {
    uri: "airport://flight-queue",
    name: "Flight queue",
    description: "All submitted flights, including queued, scheduled, unscheduled, and cancelled flights.",
    read: (airport: Airport) => airport.queue(),
  },
  {
    uri: "airport://runways",
    name: "Runway usage",
    description: "Configured runways with lengths and scheduled operations.",
    read: (airport: Airport) => airport.runwayState(),
  },
  {
    uri: "airport://timeline",
    name: "Scheduled operation timeline",
    description: "Chronological runway operations with gate and ground-crew assignments.",
    read: (airport: Airport) => airport.timeline,
  },
] as const;

export function registerAirportResources(server: ResourceServer, airport: Airport): void {
  for (const resource of resourceDefinitions) {
    server.registerResource(resource.uri, resource.name, resource.description, () => resource.read(airport));
  }
}
