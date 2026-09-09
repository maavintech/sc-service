/**
 * Resolves which accounts hold a given Permission Catalog feature — the same
 * union-of-grants logic as driveinnovate/server's
 * services/permission.service.js#getFeatureKeySet (direct feature grant, OR
 * a grant of the feature's module, OR a grant of any package containing that
 * module; papa (parentId===0) holds every feature implicitly), computed set-
 * wise for every account at once instead of one row at a time.
 *
 * This is what makes 'canViewRTO'/'canViewChallans' the single source of
 * truth for both sides: driveinnovate's read API gates on them per-request
 * via requirePermission(), and rtoFetchJob/challanFetchJob gate on them here
 * per scheduled run — the same Permission Catalog entry (papa/dealer sets it
 * from the client's Permissions tab), no separate account-level flag.
 */
const { Op } = require('sequelize');
const { User, PermissionFeature, PermissionPackageModule, UserFeatureGrant, UserModuleGrant, UserPackageGrant } = require('../models');

/**
 * @param {string} featureKey - e.g. 'canViewRTO' or 'canViewChallans'
 * @returns {Promise<Set<number>>} userIds that hold this feature
 */
async function getAccountIdsWithFeature(featureKey) {
  const feature = await PermissionFeature.findOne({ where: { key: featureKey } });
  if (!feature) {
    console.warn(`[permissionResolver] Unknown feature key "${featureKey}" — Permission Catalog not seeded yet? Returning empty set.`);
    return new Set();
  }

  const [directGrants, moduleGrants, packageModules, papas] = await Promise.all([
    UserFeatureGrant.findAll({ where: { featureId: feature.id }, attributes: ['userId'] }),
    UserModuleGrant.findAll({ where: { moduleId: feature.moduleId }, attributes: ['userId'] }),
    PermissionPackageModule.findAll({ where: { moduleId: feature.moduleId }, attributes: ['packageId'] }),
    User.findAll({ where: { parentId: 0 }, attributes: ['id'] }),
  ]);

  const ids = new Set();
  directGrants.forEach((g) => ids.add(g.userId));
  moduleGrants.forEach((g) => ids.add(g.userId));
  // Every papa account (parentId===0) holds every feature implicitly — same
  // as getFeatureKeySet. This makes papa's OWN directly-owned vehicles
  // (Vehicle.clientId === papaId) eligible without a grant row; it does NOT
  // pull in a papa's downstream network — each descendant client still needs
  // its own grant (direct/module/package) and is fetched under its own id.
  papas.forEach((p) => ids.add(p.id));

  const packageIds = packageModules.map((pm) => pm.packageId);
  if (packageIds.length) {
    const packageGrants = await UserPackageGrant.findAll({ where: { packageId: { [Op.in]: packageIds } }, attributes: ['userId'] });
    packageGrants.forEach((g) => ids.add(g.userId));
  }

  return ids;
}

module.exports = { getAccountIdsWithFeature };
