# Airport ATC MCP Server

A lightweight, dependency-free Model Context Protocol server for coordinating airport arrivals and departures. It runs over MCP stdio using newline-delimited JSON-RPC messages.

## Configuration

All airport limits are required environment variables. The server exits with a clear configuration error if a value is missing, non-numeric, negative, or invalid.

The loader also accepts concise aliases without the `AIRPORT_` prefix, such as `RUNWAY_COUNT`, `GATE_COUNT`, and `RUNWAY_LENGTHS`.

| Variable | Meaning |
| --- | --- |
| `AIRPORT_RUNWAY_COUNT` | Number of runways |
| `AIRPORT_GATE_COUNT` | Number of gates |
| `AIRPORT_GROUND_CREW_COUNT` | Number of ground crews |
| `AIRPORT_TAKEOFF_SEPARATION_MINUTES` | Same-runway departure separation |
| `AIRPORT_LANDING_SEPARATION_MINUTES` | Same-runway arrival separation |
| `AIRPORT_MIXED_SEPARATION_MINUTES` | Same-runway arrival/departure separation |
| `AIRPORT_GATE_TURNAROUND_MINUTES` | Gate and crew service duration |
| `AIRPORT_DEPENDENCY_BUFFER_MINUTES` | Delay after a dependency completes |
| `AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES` | Maximum allowed completion time |
| `AIRPORT_RUNWAY_LENGTHS_METERS` | Comma-separated runway lengths, one positive integer per configured runway |

Example MCP client configuration:

```json
{
  "mcpServers": {
    "airport-atc": {
      "command": "node",
      "args": ["src/index.js"],
      "env": {
        "AIRPORT_RUNWAY_COUNT": "2",
        "AIRPORT_GATE_COUNT": "4",
        "AIRPORT_GROUND_CREW_COUNT": "3",
        "AIRPORT_TAKEOFF_SEPARATION_MINUTES": "3",
        "AIRPORT_LANDING_SEPARATION_MINUTES": "4",
        "AIRPORT_MIXED_SEPARATION_MINUTES": "5",
        "AIRPORT_GATE_TURNAROUND_MINUTES": "20",
        "AIRPORT_DEPENDENCY_BUFFER_MINUTES": "10",
        "AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES": "1440",
        "AIRPORT_RUNWAY_LENGTHS_METERS": "2500,3500"
      }
    }
  }
}
```

## MCP Interface

Tools:

- `submit_flight`: add a flight with `flight_number`, `operation_type`, `priority`, optional `dependencies`, and optional runway requirements: `allowed_runways` and/or `minimum_length_meters`.
- `generate_schedule`: replace the current schedule with a new deterministic schedule.
- `get_airport_status`: inspect structured flight counts, per-resource usage, constraint indicators, blocked flights, and schedule completion time.
- `cancel_flight`: cancel a flight, block affected dependent flights, and refresh.
- `analyze_bottleneck`: identify the longest active scheduled dependency chain and its elapsed duration.

Tool inputs are validated with Zod schemas. Every tool returns JSON in both MCP `structuredContent` and text form. Validation and domain errors return `isError: true` with a machine-readable error code and a clear message.

Resources:

- `airport://flight-queue`: all queued, scheduled, unscheduled, and cancelled flights.
- `airport://runways`: runway allocations and operation times.
- `airport://timeline`: chronological scheduled operations.

The scheduler prioritizes high-priority flights first when dependencies permit. Arrivals reserve runway time followed by gate and crew turnaround. Departures reserve gate and crew turnaround followed by runway time. Runway separation values are enforced independently for every runway.

Flights that exceed the scheduling horizon or cannot proceed because of dependency problems remain visible in `airport://flight-queue` and in the airport status response with a reason and machine-readable reason code. Re-running `generate_schedule` with the same queue and configuration produces the same schedule.

## Test

```powershell
npm.cmd test
```
