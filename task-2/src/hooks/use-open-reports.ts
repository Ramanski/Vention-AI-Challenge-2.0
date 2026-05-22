import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Set of event_ids (from the provided list) that have at least
 * one open report. Restricted by RLS, so only events the caller can see
 * reports for will be counted.
 */
export function useOpenReportEventIds(eventIds: string[]) {
  const key = [...eventIds].sort().join(",");
  return useQuery({
    enabled: eventIds.length > 0,
    queryKey: ["open-reports-by-event", key],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("event_id")
        .eq("status", "open")
        .in("event_id", eventIds);
      return new Set<string>((data ?? []).map((r: any) => r.event_id).filter(Boolean));
    },
  });
}
