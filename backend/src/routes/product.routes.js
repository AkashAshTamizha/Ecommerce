const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createProductRules } = require('../validators/product.validator');
const { productImageUpload } = require('../config/cloudinary');

router.use(authenticate);

router.get('/', ctrl.listProducts);
router.get('/:id', ctrl.getProduct);

router.post('/', authorize('SUPER_ADMIN', 'SELLER'), validate(createProductRules), ctrl.createProduct);
router.patch('/:id', authorize('SUPER_ADMIN', 'SELLER'), ctrl.updateProduct);
router.delete('/:id', authorize('SUPER_ADMIN', 'SELLER'), ctrl.deleteProduct);

router.post('/bulk-action', authorize('SUPER_ADMIN'), ctrl.bulkAction);
router.patch('/:id/approve', authorize('SUPER_ADMIN'), ctrl.approveProduct);
router.patch('/:id/reject', authorize('SUPER_ADMIN'), ctrl.rejectProduct);

router.post('/:id/variants', authorize('SUPER_ADMIN', 'SELLER'), ctrl.createVariant);
router.patch('/:id/variants/:variantId', authorize('SUPER_ADMIN', 'SELLER'), ctrl.updateVariant);
router.delete('/:id/variants/:variantId', authorize('SUPER_ADMIN', 'SELLER'), ctrl.deleteVariant);

router.post(
  '/:id/images',
  authorize('SUPER_ADMIN', 'SELLER'),
  productImageUpload.array('images', 10),
  ctrl.uploadImages
);
router.delete('/:id/images/:imageId', authorize('SUPER_ADMIN', 'SELLER'), ctrl.deleteImage);

router.post(
  '/:id/variants/:variantId/images',
  authorize('SUPER_ADMIN', 'SELLER'),
  productImageUpload.array('images', 10),
  ctrl.uploadVariantImages
);
router.patch('/:id/variants/:variantId/images/:imageId/primary', authorize('SUPER_ADMIN', 'SELLER'), ctrl.setVariantPrimaryImage);
router.delete('/:id/variants/:variantId/images/:imageId', authorize('SUPER_ADMIN', 'SELLER'), ctrl.deleteVariantImage);

module.exports = router;
