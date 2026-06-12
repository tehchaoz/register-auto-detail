const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

let tokenCache = { token: null, exp: 0 };

async function getToken(email, key) {
  const now = Math.floor(Date.now() / 1000);
  if (now < tokenCache.exp - 60) return tokenCache.token;
  const pk = Buffer.from(key, "base64").toString().replace(/\\n/g, "\n");
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url",
  );
  const p = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  ).toString("base64url");
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), pk);
  const jwt = `${h}.${p}.${sig.toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  const d = await res.json();
  tokenCache = { token: d.access_token, exp: now + 3600 };
  return d.access_token;
}

function enc(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ok = (d) => ({
  statusCode: 200,
  headers: { ...H, "Content-Type": "application/json" },
  body: JSON.stringify({ status: "ok", ...d }),
});

const fail = (msg) => ({
  statusCode: 200,
  headers: { ...H, "Content-Type": "application/json" },
  body: JSON.stringify({ status: "error", message: msg }),
});

async function gsAuth(method, path, body, SID, email, key) {
  const token = await getToken(email, key);
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SID}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function gs(path, SID, apiKey) {
  const q = apiKey ? `?key=${apiKey}` : "";
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SID}/${path}${q}`,
  );
}

const COLS = [
  "Date",
  "Dealership",
  "VIN",
  "Brand",
  "Model",
  "Year",
  "Stock#",
  "RO#",
  "Department",
  "Service",
  "Price",
  "Invoice",
  "Notes",
  "ID",
];

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 204, headers: H, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: H, body: "Method not allowed" };

  const SID = process.env.SHEET_ID;
  const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
  const SA_KEY = process.env.GOOGLE_SA_KEY;

  if (!SID || !SA_EMAIL || !SA_KEY) return fail("Export not configured");

  const store = getStore("rad");

  try {
    const raw = await store.get("entries");
    const entries = raw ? JSON.parse(raw) : [];
    if (!entries.length) return ok({ message: "No entries to export" });

    const groups = {};
    for (const e of entries) {
      const k = e.dealership || "Unknown";
      if (!groups[k]) groups[k] = [];
      groups[k].push(e);
    }

    // Get existing sheets
    const ssRes = await gs("", SID);
    const ss = await ssRes.json();
    const existing = new Set((ss.sheets || []).map((s) => s.properties.title));

    let count = 0;
    for (const [tabName, rows] of Object.entries(groups)) {
      if (!existing.has(tabName)) {
        await gsAuth(
          "POST",
          ":batchUpdate",
          {
            requests: [{ addSheet: { properties: { title: tabName } } }],
          },
          SID,
          SA_EMAIL,
          SA_KEY,
        );
        await gsAuth(
          "PUT",
          `values/${encodeURIComponent(enc(tabName) + "!A1:N1")}?valueInputOption=USER_ENTERED`,
          { values: [COLS] },
          SID,
          SA_EMAIL,
          SA_KEY,
        );
        existing.add(tabName);
      }

      const dataRows = rows.map((r) => [
        r.date,
        r.dealership,
        r.vin,
        r.brand,
        r.model,
        r.year,
        r.stock,
        r.ro,
        r.department,
        r.service,
        String(r.price),
        r.invoice || "",
        r.notes,
        r.id,
      ]);

      await gsAuth(
        "POST",
        `values/${encodeURIComponent(enc(tabName) + "!A2:N")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { values: dataRows },
        SID,
        SA_EMAIL,
        SA_KEY,
      );
      count += dataRows.length;
    }

    return ok({ groups: Object.keys(groups).length, entries: count });
  } catch (err) {
    return fail(err.message);
  }
};
