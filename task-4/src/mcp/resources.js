export const resourceDefinitions = [
  {
    uri: "airport://flight-queue",
    name: "Flight queue",
    description: "All submitted flights, including queued, scheduled, unscheduled, and cancelled flights.",
    read: (airport) => airport.queue(),
  },
  {
    uri: "airport://runways",
    name: "Runway usage",
    description: "Configured runways with lengths and scheduled operations.",
    read: (airport) => airport.runwayState(),
  },
  {
    uri: "airport://timeline",
    name: "Scheduled operation timeline",
    description: "Chronological runway operations with gate and ground-crew assignments.",
    read: (airport) => airport.timeline,
  },
];

export function registerAirportResources(server, airport) {
  for (const resource of resourceDefinitions) {
    server.registerResource(resource.uri, resource.name, resource.description, () => resource.read(airport));
  }
}
