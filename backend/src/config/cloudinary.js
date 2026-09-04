const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Custom Multer storage engine that streams uploads straight to Cloudinary
 * using the official cloudinary v2 SDK (no local disk writes — important
 * for serverless/PaaS hosts like Railway/Render/Vercel).
 *
 * Replaces `multer-storage-cloudinary`, which is unmaintained and pins to
 * the cloudinary v1 SDK as a peer dependency (causes an ERESOLVE conflict
 * with cloudinary v2). This does the same job with zero extra dependencies.
 */
class CloudinaryStorageEngine {
  constructor({ folder, transformation, resourceType = 'image' }) {
    this.folder = folder;
    this.transformation = transformation;
    this.resourceType = resourceType;
  }

  _handleFile(req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: this.folder,
        resource_type: this.resourceType,
        transformation: this.transformation,
      },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          path: result.secure_url,   // matches the `file.path` used in controllers
          filename: result.public_id, // matches the `file.filename` used in controllers
          size: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );

    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, { resource_type: this.resourceType }, (err) => cb(err));
  }
}

const makeStorage = (folder, resourceType = 'image') =>
  new CloudinaryStorageEngine({
    folder: `ecommerce-inventory/${folder}`,
    resourceType,
    transformation:
      resourceType === 'image'
        ? [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }]
        : undefined,
  });

const productImageUpload = multer({
  storage: makeStorage('products'),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB/file, max 10 files
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

const avatarUpload = multer({
  storage: makeStorage('avatars'),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const documentUpload = multer({
  storage: makeStorage('documents', 'auto'), // 'auto' supports PDF + images for KYC docs
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

module.exports = { cloudinary, productImageUpload, avatarUpload, documentUpload };
