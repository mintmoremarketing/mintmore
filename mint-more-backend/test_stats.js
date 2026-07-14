const adminService = require('./src/modules/admin/admin.service');
const { query } = require('./src/config/database');

async function test() {
  try {
    const stats = await adminService.getDashboardStats();
    console.log(JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('FAILED:', err.stack);
  }
  process.exit(0);
}
test();
