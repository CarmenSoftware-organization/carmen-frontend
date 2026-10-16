import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";

export async function saveDimensionRecord(
  endpoint: string,
  data: Record<string, unknown>,
  current?: { id: string; doc_version: number } | null,
): Promise<{ id: string; doc_version: number }> {
  const response = current
    ? await httpClient.put(`${endpoint}/${current.id}`, { ...data, doc_version: current.doc_version })
    : await httpClient.post(endpoint, data);
  if (!response.ok) throw await ApiError.from(response, "Unable to save dimension");
  const body = await response.json();
  if (body?.success === false) throw new Error(body.message || "Unable to save dimension");
  const record = body.data ?? body;
  if (!record.id || typeof record.doc_version !== "number") throw new Error("Invalid dimension save response. Reload before retrying.");
  return record;
}
