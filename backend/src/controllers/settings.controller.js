const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');

const DEFAULTS = {
  storeName: 'EcomXC',
  supportEmail: 'support@ecomxc.com',
  currency: 'INR',
  defaultCommissionPct: 10,
  lowStockThreshold: 5,
  taxPct: 18,
  allowSellerSelfRegistration: true,
  maintenanceMode: false,
};

// GET /api/v1/settings
const getSettings = asyncHandler(async (req, res) => {
  const rows = await prisma.systemSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return success(res, 200, 'Settings fetched', { ...DEFAULTS, ...stored });
});

// PATCH /api/v1/settings   body: { [key]: value, ... }
const updateSettings = asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body || {}).filter(([key]) => key in DEFAULTS);

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  const rows = await prisma.systemSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return success(res, 200, 'Settings updated', { ...DEFAULTS, ...stored });
});

module.exports = { getSettings, updateSettings };
