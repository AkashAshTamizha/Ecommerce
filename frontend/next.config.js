const DEFAULT_API_URL = 'http://localhost:5000/api/v1';

/**
 * Resolve and validate the backend API URL used for the /api/backend rewrite.
 * Fails the build with a clear message instead of letting Next.js reject the
 * rewrite later with an opaque "destination does not start with /, http://,
 * or https://" error.
 */
function resolveApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const value = raw.trim();

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `[next.config.js] NEXT_PUBLIC_API_URL is not a valid absolute URL: "${value}". ` +
        'It must include the scheme, e.g. "https://your-backend.onrender.com/api/v1". ' +
        'Check Vercel → Project Settings → Environment Variables → Production.'
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `[next.config.js] NEXT_PUBLIC_API_URL must use http:// or https://, got "${parsed.protocol}" ` +
        `(value: "${value}").`
    );
  }

  // Strip a trailing slash so "${value}/:path*" doesn't produce a double slash.
  return value.replace(/\/+$/, '');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async rewrites() {
    const apiUrl = resolveApiUrl();
    return [
      {
        source: '/api/backend/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;