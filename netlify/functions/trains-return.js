const TRANSPORT_API_ID = process.env.TRANSPORT_API_ID;
const TRANSPORT_API_KEY = process.env.TRANSPORT_API_KEY;
const TFL_API_KEY = process.env.TFL_API_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const [railData, tubeData, railStatus, tubeStatus] = await Promise.allSettled([
      fetchRailReturn(),
      fetchTubeReturn(),
      fetchRailStatus(),
      fetchTubeStatus(),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        rail: railData.status === "fulfilled" ? railData.value : { error: railData.reason?.message },
        tube: tubeData.status === "fulfilled" ? tubeData.value : { error: tubeData.reason?.message },
        railStatus: railStatus.status === "fulfilled" ? railStatus.value : null,
        tubeStatus: tubeStatus.status === "fulfilled" ? tubeStatus.value : null,
        fetchedAt: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

async function fetchRailReturn() {
  // Euston (EUS) → Hemel Hempstead (HML)
  const url = `https://transportapi.com/v3/uk/train/station/EUS/live.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&calling_at=HML&darwin=true&train_status=passenger`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Transport API error: ${res.status}`);
  const data = await res.json();
  const deps = (data.departures?.all || []).slice(0, 6).map(d => ({
    scheduledDep: d.aimed_departure_time,
    expectedDep: d.expected_departure_time,
    scheduledArr: d.aimed_arrival_time,
    expectedArr: d.expected_arrival_time,
    platform: d.platform || "—",
    operator: d.operator_name,
    status: d.status,
    cancelled: d.status === "CANCELLED",
    destination: d.destination_name,
  }));
  return { station: "London Euston", crs: "EUS", departures: deps };
}

async function fetchTubeReturn() {
  // Euston Square NAPTAN: 940GZZLUESQ
  const keyParam = TFL_API_KEY ? `?app_key=${TFL_API_KEY}` : "";
  const url = `https://api.tfl.gov.uk/StopPoint/940GZZLUESQ/Arrivals${keyParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TfL API error: ${res.status}`);
  const data = await res.json();
  const met = data
    .filter(t => t.lineName === "Metropolitan" || t.lineId === "metropolitan")
    .filter(t => t.towards && (t.towards.toLowerCase().includes('chalfont') || t.towards.toLowerCase().includes('amersham') || t.towards.toLowerCase().includes('chesham') || t.towards.toLowerCase().includes('watford')))
    .sort((a, b) => a.timeToStation - b.timeToStation)
    .slice(0, 6)
    .map(t => {
      const dep = new Date(Date.now() + t.timeToStation * 1000);
      const arr = new Date(dep.getTime() + 60 * 60 * 1000); // ~60min to Chalfont
      return {
        scheduledDep: `${String(dep.getHours()).padStart(2,"0")}:${String(dep.getMinutes()).padStart(2,"0")}`,
        expectedDep:  `${String(dep.getHours()).padStart(2,"0")}:${String(dep.getMinutes()).padStart(2,"0")}`,
        arrivalChalfont: `${String(arr.getHours()).padStart(2,"0")}:${String(arr.getMinutes()).padStart(2,"0")}`,
        destination: t.destinationName,
        towards: t.towards,
        timeToStation: t.timeToStation,
      };
    });
  return { station: "Euston Square", naptan: "940GZZLUESQ", departures: met };
}

async function fetchRailStatus() {
  const url = `https://transportapi.com/v3/uk/train/station/EUS/live.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&darwin=true&train_status=passenger`;
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
  const statuses = line.lineStatuses || [];
  const disrupted = statuses.find(s => s.statusSeverity !== 10);
  if (disrupted) {
    return { severity: disrupted.statusSeverityDescription, reason: disrupted.reason || null };
  }
  return { severity: "Good Service", reason: null };
}
