"use client";

import { useEffect, useState } from "react";

const COUNTRIES = [
  "Nigeria",
  "Côte d'Ivoire",
  "Niger",
  "Cameroun",
  "Afrique du Sud",
  "Senegal",
  "Ghana",
  "Mali",
  "RDC",
];

const SECTORS = [
  { value: "ciment_colle", label: "Ciment colle / Adhésif carrelage" },
  { value: "peinture", label: "Peinture" },
];

export default function Home() {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [sector, setSector] = useState(SECTORS[0].value);
  const [customQuery, setCustomQuery] = useState("");
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [log, setLog] = useState<string[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);

  function addLog(msg: string) {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 50));
  }

  async function refresh() {
    const res = await fetch("/api/businesses");
    const data = await res.json();
    if (data.businesses) {
      setBusinesses(data.businesses);
      setCounts(data.counts);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function discoverOne(c: string, s: string, q?: string) {
    const res = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: c, sector: s, query: q }),
    });
    return res.json();
  }

  async function enrichOne() {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize: 5 }),
    });
    return res.json();
  }

  // Runs discovery for every country x sector combo, then enriches everything found.
  async function runFullPipeline() {
    setBulkRunning(true);
    try {
      addLog(`Starting full run: ${COUNTRIES.length} countries x ${SECTORS.length} sectors`);
      for (const c of COUNTRIES) {
        for (const s of SECTORS) {
          try {
            const data = await discoverOne(c, s.value);
            if (data.error) {
              addLog(`Discovery error (${c}/${s.value}): ${data.error}`);
            } else {
              addLog(`Discovered ${c} / ${s.value}: +${data.inserted} new (found ${data.candidatesFound})`);
            }
          } catch (err: any) {
            addLog(`Discovery error (${c}/${s.value}): ${err.message}`);
          }
          await refresh();
        }
      }

      addLog("Discovery done for all countries. Starting enrichment...");

      // Keep enriching until nothing left
      // Safety cap to avoid infinite loops if something goes wrong
      for (let i = 0; i < 200; i++) {
        const data = await enrichOne();
        if (data.error) {
          addLog(`Enrichment error: ${data.error}`);
          break;
        }
        if (data.processed === 0) {
          addLog("Enrichment complete — nothing left to enrich.");
          break;
        }
        addLog(
          `Enriched batch: ` + data.results.map((r: any) => `${r.name} → ${r.status}`).join(", ")
        );
        await refresh();
      }

      addLog("Full run finished.");
    } finally {
      setBulkRunning(false);
      await refresh();
    }
  }

  async function runDiscovery() {
    setDiscoverLoading(true);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, sector, query: customQuery || undefined }),
      });
      const data = await res.json();
      if (data.error) {
        addLog(`Discovery error: ${data.error}`);
      } else {
        addLog(
          `Discovery (${country} / ${sector}) — found ${data.candidatesFound}, inserted ${data.inserted}. Query: "${data.query}"`
        );
      }
      await refresh();
    } catch (err: any) {
      addLog(`Discovery error: ${err.message}`);
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function runEnrichBatch() {
    setEnrichLoading(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 5 }),
      });
      const data = await res.json();
      if (data.error) {
        addLog(`Enrichment error: ${data.error}`);
      } else if (data.processed === 0) {
        addLog("Nothing left to enrich.");
      } else {
        addLog(
          `Enriched batch of ${data.processed}: ` +
            data.results.map((r: any) => `${r.name} → ${r.status}`).join(", ")
        );
      }
      await refresh();
    } catch (err: any) {
      addLog(`Enrichment error: ${err.message}`);
    } finally {
      setEnrichLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Africa Manufacturer Leads</h1>
          <p>Ciment colle &amp; Peinture — discovery + enrichment pipeline</p>
        </div>
        <div className="stats">
          <div className="stat"><span className="num">{counts.total ?? 0}</span>total</div>
          <div className="stat"><span className="num">{counts.discovered ?? 0}</span>new</div>
          <div className="stat"><span className="num">{counts.enriched ?? 0}</span>done</div>
          <div className="stat"><span className="num">{counts.failed ?? 0}</span>failed</div>
        </div>
      </div>

      <div className="panel">
        <h2>One-click run (all countries × sectors)</h2>
        <div className="row">
          <button onClick={runFullPipeline} disabled={bulkRunning || discoverLoading || enrichLoading}>
            {bulkRunning ? "Running… (keep this tab open)" : "Run full pipeline"}
          </button>
          <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12 }}>
            Discovers companies for every country/sector combo, then enriches everything found.
            This can take a long time (10-30+ min) — keep the tab open while it runs.
          </span>
        </div>
        {log.length > 0 && <div className="log">{log.join("\n")}</div>}
      </div>

      <div className="panel">
        <h2>1 · Discover companies (single run)</h2>
        <div className="row">
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            {SECTORS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Optional: custom search query (else auto-generated)"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
          />
          <button onClick={runDiscovery} disabled={discoverLoading || bulkRunning}>
            {discoverLoading ? "Searching…" : "Run discovery"}
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>2 · Enrich (director, email, phone, site)</h2>
        <div className="row">
          <button onClick={runEnrichBatch} disabled={enrichLoading || bulkRunning}>
            {enrichLoading ? "Enriching…" : "Enrich next 5"}
          </button>
          <button className="secondary" onClick={refresh}>Refresh table</button>
          <a href="/api/export"><button className="secondary">Export CSV</button></a>
        </div>
        {log.length > 0 && <div className="log">{log.join("\n")}</div>}
      </div>

      <div className="panel">
        <h2>Businesses ({businesses.length})</h2>
        {businesses.length === 0 ? (
          <div className="empty">No businesses yet. Run discovery above to start.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sector</th>
                <th>Country / City</th>
                <th>Website</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Director</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.sector === "peinture" ? "Peinture" : "Ciment colle"}</td>
                  <td>{b.country}{b.city ? ` / ${b.city}` : ""}</td>
                  <td>{b.website ? <a href={b.website} target="_blank">{b.website}</a> : "—"}</td>
                  <td>{b.phone || "—"}</td>
                  <td>{b.email || "—"}</td>
                  <td>{b.director_name || "—"}</td>
                  <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
