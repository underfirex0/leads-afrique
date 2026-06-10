import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("country", { ascending: true });

    if (error) throw error;

    const headers = [
      "name",
      "sector",
      "country",
      "city",
      "website",
      "phone",
      "email",
      "director_name",
      "status",
      "notes",
    ];

    const lines = [headers.join(",")];
    for (const row of data || []) {
      lines.push(headers.map((h) => csvEscape((row as any)[h])).join(","));
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-export.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}