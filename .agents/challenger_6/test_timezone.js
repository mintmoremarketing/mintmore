const assert = require('assert');

const toLocalDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Test with date string YYYY-MM-DD in UTC vs local
console.log('Testing toLocalDateKey with YYYY-MM-DD string:');
console.log('Input: "2026-08-15" -> Output:', toLocalDateKey('2026-08-15'));
console.log('Input: "2026-08-15T00:00:00" -> Output:', toLocalDateKey('2026-08-15T00:00:00'));

// Test date constructed with year, month, day
console.log('Input: new Date(2026, 7, 15) -> Output:', toLocalDateKey(new Date(2026, 7, 15)));
