function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateSKU(name) {
  const prefix = name
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'PROD';
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-${suffix}`;
}

module.exports = { slugify, generateSKU };
