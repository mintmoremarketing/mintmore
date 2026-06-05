const { query } = require('../config/database');
const AppError = require('../utils/AppError');
const { getEntitlements } = require('../modules/commerce/entitlement.service');

const requirePermission = (permission) => async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') throw new AppError('Admin access required', 403);
    const result = await query(
      'SELECT is_super_admin, admin_permissions FROM users WHERE id = $1 AND role = $2',
      [req.user.sub, 'admin']
    );
    const admin = result.rows[0];
    if (!admin) throw new AppError('Admin account not found', 403);
    const permissions = admin.admin_permissions || [];
    if (!admin.is_super_admin && !permissions.includes('*') && !permissions.includes(permission)) {
      throw new AppError(`Missing admin permission: ${permission}`, 403);
    }
    req.adminAccess = admin;
    next();
  } catch (err) { next(err); }
};

const requireEntitlement = (entitlement) => async (req, res, next) => {
  try {
    const access = await getEntitlements(req.user.sub);
    if (!access?.[entitlement]) {
      const err = new AppError(`This action requires ${entitlement.replace(/^can_/, '').replace(/_/g, ' ')}`, 403);
      err.errors = [{ code: 'ENTITLEMENT_REQUIRED', entitlement, access_state: access?.access_state }];
      throw err;
    }
    req.entitlements = access;
    next();
  } catch (err) { next(err); }
};

const requirePermissionIfAdmin = (permission) => async (req, res, next) => {
  if (req.user?.role !== 'admin') return next();
  return requirePermission(permission)(req, res, next);
};

module.exports = { requirePermission, requireEntitlement, requirePermissionIfAdmin };
