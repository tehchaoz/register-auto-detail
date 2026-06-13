const SHEET_ID = "1Y7R0JdwKP9VbjmXVXrJw4pfshEcYiJPJla2bWel6F0I"
const SHEET_NAME = "Sheet1"

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  let sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME)
    sheet.appendRow(["ID", "Date", "Dealership", "VIN", "Brand", "Model", "Year", "Stock#", "RO#", "Department", "Service", "Price", "Invoice", "Notes", "SyncedAt"])
  }
  return sheet
}

function doGet(e) {
  const sheet = getSheet()
  const data = sheet.getDataRange().getValues()
  const headers = data[0]
  const entries = []
  for (let i = 1; i < data.length; i++) {
    const row = {}
    headers.forEach((h, j) => { row[h] = data[i][j] })
    entries.push(row)
  }
  if (e.parameter.vin && e.parameter.date) {
    const exists = entries.some(r => r.VIN === e.parameter.vin && r.Date === e.parameter.date)
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", exists }))
      .setMimeType(ContentService.MimeType.JSON)
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", entries }))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  const b = e.parameter

  if (b._method === "PUT") {
    const sheet = getSheet()
    const data = sheet.getDataRange().getValues()
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === b.id) {
        const updated = [
          b.id, b.date || "", b.dealership || "", b.vin || "",
          b.brand || "", b.model || "", b.year || "", b.stock || "",
          b.ro || "", b.department || "", b.service || "",
          b.price || "", b.invoice || "", b.notes || "",
          new Date().toISOString(),
        ]
        sheet.getRange(i + 1, 1, 1, 15).setValues([updated])
        return ContentService
          .createTextOutput(JSON.stringify({ status: "ok", entry: { id: b.id } }))
          .setMimeType(ContentService.MimeType.JSON)
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: "Entry not found" }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  const sheet = getSheet()
  const entry = {
    ID: Utilities.getUuid(),
    Date: b.date || "",
    Dealership: b.dealership || "",
    VIN: b.vin || "",
    Brand: b.brand || "",
    Model: b.model || "",
    Year: b.year || "",
    "Stock#": b.stock || "",
    "RO#": b.ro || "",
    Department: b.department || "",
    Service: b.service || "",
    Price: b.price || "",
    Invoice: b.invoice || "",
    Notes: b.notes || "",
    SyncedAt: new Date().toISOString(),
  }
  sheet.appendRow([
    entry.ID, entry.Date, entry.Dealership, entry.VIN, entry.Brand,
    entry.Model, entry.Year, entry["Stock#"], entry["RO#"],
    entry.Department, entry.Service, entry.Price, entry.Invoice,
    entry.Notes, entry.SyncedAt,
  ])
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", entry }))
    .setMimeType(ContentService.MimeType.JSON)
}

function doOptions(e) {
  return ContentService
    .createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
}
