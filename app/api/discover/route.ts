import { NextRequest, NextResponse } from "next/server";
import { tavilySearch } from "../../../lib/tavily";
import { askClaudeJSON } from "../../../lib/claude";
import { getSupabase } from "../../../lib/supabase";

export const maxDuration = 60;

/**
 * POST body: { country: string, sector: "ciment_colle" | "peinture", query?: string }
 *
 * Runs a Tavily search (directories, associations, exhibitor lists are best),
 * asks Claude to extract a list of {name, city, website} candidates,
 * and inserts new rows into Supabase with status="discovered".
 */
export async function POST(req: NextRequest) {
  try {
    const { country, sector, query } = await req.json();

    if (!country || !sector) {
      return NextResponse.json({ error: "country and sector are required" }, { status: 400 });
    }

    const sectorLabel =
      sector === "peinture" ? "fabricant de peinture" : "fabricant de ciment colle / colle carrelage";

    const searchQuery =
      query ||
      `liste fabricants ${sectorLabel} ${country} annuaire entreprises`;

    const results = await tavilySearch(searchQuery, 8);

    const context = results
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 1500)}`)
      .join("\n\n---\n\n");

    const extracted = await askClaudeJSON(
      `You extract company names from web search results for B2B lead generation.
Return ONLY a JSON array (no prose, no markdown fences) of objects with this shape:
[{"name": "...", "city": "...", "website": "..."}]
Rules:
- Only include companies that look like manufacturers/producers in the sector: ${sectorLabel}.
- "city" can be empty string if unknown.
- "website" can be empty string if unknown (only include if clearly a company's own site, not a directory).
- Do not invent companies. Only extract what's actually mentioned in the text.
- Deduplicate by name.`,
      `Country: ${country}\nSector: ${sectorLabel}\n\nSearch results:\n\n${context}`
    );

    const supabase = getSupabase();
    const rows = (Array.isArray(extracted) ? extracted : [])
      .filter((c: any) => c?.name)
      .map((c: any) => ({
        name: String(c.name).trim(),
        city: c.city ? String(c.city).trim() : null,
        website: c.website ? String(c.website).trim() : null,
        country,
        sector,
        status: "discovered",
        source_links: results.map((r) => r.url),
      }));

    let inserted = 0;
    if (rows.length) {
      // upsert to avoid duplicate (name, country) pairs
      const { data, error } = await supabase
        .from("businesses")
        .upsert(rows, { onConflict: "name,country", ignoreDuplicates: true })
        .select();
      if (error) throw error;
      inserted = data?.length ?? 0;
    }

    return NextResponse.json({
      query: searchQuery,
      candidatesFound: rows.length,
      inserted,
      candidates: rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}