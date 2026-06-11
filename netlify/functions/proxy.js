exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 204, headers, body: "" };

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { url, data } = JSON.parse(event.body);
    if (!url) throw new Error("No URL provided");

    const params = encodeURIComponent(JSON.stringify(data));
    const res = await fetch(url + "?data=" + params);
    const text = await res.text();

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: "error", message: err.message }),
    };
  }
};
