const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

async function all(store) {
  const raw = await store.get("entries");
  return raw ? JSON.parse(raw) : [];
}

exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 204, headers: H, body: "" };

  const store = getStore({ name: "rad", siteID: process.env.SITE_ID });

  try {
    const url = new URL(
      event.rawUrl ||
        `https://placeholder${event.path}${event.queryString ? "?" + event.queryString : ""}`,
    );
    const path =
      url.pathname.replace(/^\/\.netlify\/functions\/entries/, "") || "/";

    // GET /check-vin?vin=X&date=Y
    if (event.httpMethod === "GET" && path === "/check-vin") {
      const vin = url.searchParams.get("vin");
      const date = url.searchParams.get("date");
      if (!vin || !date) return fail("Missing vin or date");
      const entries = await all(store);
      return ok({
        exists: entries.some((e) => e.vin === vin && e.date === date),
      });
    }

    // GET /
    if (event.httpMethod === "GET") {
      const entries = await all(store);
      return ok({ entries });
    }

    // POST /
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      if (!body.vin) return fail("Missing vin");
      const entries = await all(store);
      const entry = {
        id: crypto.randomUUID(),
        date: body.date || "",
        dealership: body.dealership || "",
        vin: body.vin || "",
        brand: body.brand || "",
        model: body.model || "",
        year: body.year || "",
        stock: body.stock || "",
        ro: body.ro || "",
        department: body.department || "",
        service: body.service || "",
        price: Number(body.price) || 0,
        invoice: body.invoice || "",
        notes: body.notes || "",
        syncedAt: new Date().toISOString(),
      };
      entries.push(entry);
      await store.set("entries", JSON.stringify(entries));
      return ok({ entry });
    }

    // PUT /
    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body);
      if (!body.id) return fail("Missing id");
      const entries = await all(store);
      const idx = entries.findIndex((e) => e.id === body.id);
      if (idx === -1) return fail("Entry not found");
      entries[idx] = {
        ...entries[idx],
        ...body,
        syncedAt: new Date().toISOString(),
      };
      await store.set("entries", JSON.stringify(entries));
      return ok({ entry: entries[idx] });
    }

    // DELETE /?id=X
    if (event.httpMethod === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return fail("Missing id");
      const entries = await all(store);
      const filtered = entries.filter((e) => e.id !== id);
      if (filtered.length === entries.length) return fail("Entry not found");
      await store.set("entries", JSON.stringify(filtered));
      return ok({ action: "deleted" });
    }

    return fail("Method not supported");
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "error", message: err.message }),
    };
  }
};
