import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const counts = {
      total: data?.length ?? 0,
      discovered: data?.filter((b) => b.status === "discovered").length ?? 0,
      enriching: data?.filter((b) => b.status === "enriching").length ?? 0,
      enriched: data?.filter((b) => b.status === "enriched").length ?? 0,
      failed: data?.filter((b) => b.status === "failed").length ?? 0,
    };

    return NextResponse.json({ businesses: data, counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
