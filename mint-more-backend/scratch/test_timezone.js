const toLocalDateTimeInput = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function run() {
  const inputVal = "2026-07-23T17:18";
  console.log("1. User entered local input value:", inputVal);

  const parsedLocalDate = new Date(inputVal);
  console.log("2. Parsed Date object:", parsedLocalDate.toString());

  const isoString = parsedLocalDate.toISOString();
  console.log("3. Formatted ISO string sent to backend:", isoString);

  const parsedFromIso = new Date(isoString);
  console.log("4. Parsed from ISO on frontend:", parsedFromIso.toString());

  const localInputVal = toLocalDateTimeInput(parsedFromIso);
  console.log("5. Re-formatted for datetime-local input field (editing):", localInputVal);

  if (inputVal === localInputVal) {
    console.log("✅ SUCCESS: The date-time values match exactly before and after timezone transit!");
  } else {
    console.log("❌ FAILURE: Time mismatch detected.");
  }
}
run();
