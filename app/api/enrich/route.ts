import { NextRequest, NextResponse } from "next/server";
import { tavilySearch } from "../../../lib/tavily";
import { askClaudeJSON } from "../../../lib/claude";
import { getSupabase } from "../../../lib/supabase";

export const maxDuration = 60;

/**
 * POST body: { batchSize?: number }  (default 5)
 *
 * Picks businesses with status="discovered", runs a Tavily search per business
 * to find website/contact/director info, asks Claude to extract structured fields,
 * and updates the row with status="enriched" (or "failed").
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body?.batchSize) || 5, 1), 10);

    const supabase = getSupabase();

    const { data: pending, error: fetchErr } = await supabase
      .from("businesses")
      .select("*")
      .eq("status", "discovered")
      .limit(batchSize);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: "No businesses left to enrich.", processed: 0 });
    }

    const results = [];

    for (const biz of pending) {
      try {
        await supabase.from("businesses").update({ status: "enriching" }).eq("id", biz.id);

        const sectorLabel =
          biz.sector === "peinture" ? "fabricant de peinture" : "fabricant de ciment colle";

        const query = `${biz.name} ${biz.city || ""} ${biz.country || ""} ${sectorLabel} site officiel email telephone directeur general`;

        const searchResults = await tavilySearch(query, 6);

        const context = searchResults
          .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 1500)}`)
          .join("\n\n---\n\n");

        const extracted = await askClaudeJSON(
          `You extract company contact information from web search results.
Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "website": "" ,
  "phone": "",
  "email": "",
  "director_name": "",
  "notes": ""
}
Rules:
- Use empty string "" for any field you cannot find. Never invent data.
- "phone" and "email" should be the company's general contact info if a director-specific one isn't found.
- "director_name" is the CEO / Directeur Général / founder / gerant if mentioned.
- "notes" is a short (max 1 sentence) note on what the company does or any useful detail (e.g. confirmation it's a manufacturer vs distributor).`,
          `Company: ${biz.name}\nCity: ${biz.city || "unknown"}\nCountry: ${biz.country}\nSector: ${sectorLabel}\nKnown website: ${biz.website || "unknown"}\n\nSearch results:\n\n${context}`
        );

        const update: Record<string, any> = {
          status: "enriched",
          updated_at: new Date().toISOString(),
          source_links: [...(biz.source_links || []), ...searchResults.map((r) => r.url)],
        };
        if (extracted.website) update.website = extracted.website;
        if (extracted.phone) update.phone = extracted.phone;
        if (extracted.email) update.email = extracted.email;
        if (extracted.director_name) update.director_name = extracted.director_name;
        if (extracted.notes) update.notes = extracted.notes;

        await supabase.from("businesses").update(update).eq("id", biz.id);

        results.push({ id: biz.id, name: biz.name, status: "enriched", ...extracted });
      } catch (err: any) {
        await supabase
          .from("businesses")
          .update({ status: "failed", notes: `Error: ${err.message || err}` })
          .eq("id", biz.id);
        results.push({ id: biz.id, name: biz.name, status: "failed", error: err.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}