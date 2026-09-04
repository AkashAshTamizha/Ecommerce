const router = require('express').Router();
const ctrl = require('../controllers/storefront.controller');

// Fully public — no authentication required to browse the catalog.
router.get('/products', ctrl.listStorefrontProducts);
router.get('/products/:slug', ctrl.getStorefrontProduct);

module.exports = router;
