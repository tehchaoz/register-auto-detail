const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzmpmcu_f01ZoB0FlNYODQqwGYxSe7f_3-YaYD4T-cvRGojP37RIgsrMmOKT6OC06Fn/exec";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async function (e) {
  if (e.httpMethod === "OPTIONS")
    return { statusCode: 204, headers: H, body: "" };

  try {
    const qs = e.queryStringParameters
      ? "?" + new URLSearchParams(e.queryStringParameters)
      : "";
    const opts = {
      method: e.httpMethod,
      headers: { "Content-Type": "application/json" },
    };
    if (e.body) opts.body = e.body;
    const res = await fetch(GAS_URL + qs, opts);
    const body = await res.text();
    return {
      statusCode: 200,
      headers: { ...H, "Content-Type": "application/json" },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "error", message: err.message }),
    };
  }
};
