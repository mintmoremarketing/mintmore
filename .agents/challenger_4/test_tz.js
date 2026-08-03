import assert from 'node:assert';

const toLocalDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

console.log('Testing toLocalDateKey behavior with date strings...');
console.log('Current System Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

const strDate = '2026-08-15';
const isoDate = '2026-08-15T12:00:00Z';
const jsDate = new Date(2026, 7, 15); // Month index 7 is August

console.log(`toLocalDateKey('2026-08-15') =>`, toLocalDateKey(strDate));
console.log(`toLocalDateKey('2026-08-15T12:00:00Z') =>`, toLocalDateKey(isoDate));
console.log(`toLocalDateKey(new Date(2026, 7, 15)) =>`, toLocalDateKey(jsDate));
