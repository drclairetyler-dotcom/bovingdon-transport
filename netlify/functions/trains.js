const TRANSPORT_API_ID = process.env.TRANSPORT_API_ID;
const TRANSPORT_API_KEY = process.env.TRANSPORT_API_KEY;
const TFL_API_KEY = process.env.TFL_API_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  try {
    const [railData, tubeData, railStatus, tubeStatus] = await Promise.allSettled([
      fetchRail(), fetchTube(), fetchRailStatus(), fetchTubeStatus(),
    ]);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        rail: railData.status === "fulfilled" ? railData.value : { error: railData.reason?.message },
        tube: tubeData.status === "fulfilled" ? tubeData.value : { error: tubeData.reason?.message },
        railStatus: railStatus.status === "fulfilled" ? railStatus.value : null,
        tubeStatus: tubeStatus.status === "fulfilled" ? tubeStatus.value : null,
        fetchedAt: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function fetchRail() {
  // Fetch all departures from Hemel Hempstead, filter London-bound
  const url = `https://transportapi.com/v3/uk/train/station/HML/live.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&darwin=true&train_status=passenger`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Transport API error: ${res.status}`);
  const data = await res.json();
  const all = data.departures?.all || [];
  const keywords = ['euston','london','watford','wembley'];
  const filtered = all.filter(d => keywords.some(k => (d.destination_name||'').toLowerCase().includes(k)));
  const source = filtered.length > 0 ? filtered : all;
  return {
    station: "Hemel Hempstead", crs: "HML",
    departures: source.slice(0, 6).map(d => ({
      scheduledDep: d.aimed_departure_time,
      expectedDep: d.expected_departure_time,
      scheduledArr: d.aimed_arrival_time,
      expectedArr: d.expected_arrival_time,
      platform: d.platform || "—",
      operator: d.operator_name,
      status: d.status,
      cancelled: d.status === "CANCELLED",
      destination: d.destination_name,
    })),
  };
}

async function fetchTube() {
  const keyParam = TFL_API_KEY ? `?app_key=${TFL_API_KEY}` : "";
  const url = `https://api.tfl.gov.uk/StopPoint/940GZZLUCAL/Arrivals${keyParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TfL API error: ${res.status}`);
  const data = await res.json();
  const met = data
    .filter(t => t.lineName === "Metropolitan" || t.lineId === "metropolitan")
    .sort((a, b) => a.timeToStation - b.timeToStation)
    .slice(0, 6)
    .map(t => {
      const dep = new Date(Date.now() + t.timeToStation * 1000);
      const arrEuston = new Date(dep.getTime() + 60 * 60 * 1000);
      const pad = n => String(n).padStart(2,"0");
      const fmt = d => pad(d.getHours())+":"+pad(d.getMinutes());
      return {
        scheduledDep: fmt(dep),
        expectedDep: fmt(dep),
        arrivalEustonSq: fmt(arrEuston),
        destination: t.destinationName,
        towards: t.towards,
        timeToStation: t.timeToStation,
      };
    });
  return { station: "Chalfont & Latimer", naptan: "940GZZLUCAL", departures: met };
}

async function fetchRailStatus() {
  const url = `https://transportapi.com/v3/uk/train/station/HML/live.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&darwin=true&train_status=passenger`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const msgs = data.requested_from_location?.messages || [];
  return msgs.length > 0 ? msgs : null;
}

async function fetchTubeStatus() {
  const keyParam = TFL_API_KEY ? `?app_key=${TFL_API_KEY}` : "";
  const url = `https://api.tfl.gov.uk/Line/metropolitan/Status${keyParam}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const line = data[0];
  if (!line) return null;
  const disrupted = (line.lineStatuses||[]).find(s => s.statusSeverity !== 10);
  if (disrupted) return { severity: disrupted.statusSeverityDescription, reason: disrupted.reason||null };
  return { severity: "Good Service", reason: null };
}
