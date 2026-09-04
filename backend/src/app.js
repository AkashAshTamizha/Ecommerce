require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const xss = require('xss-clean');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { errorHandler, notFound } = require('./middleware/errorHandler.middleware');
const logger = require('./utils/logger');

const app = express();

// ---- Security & core middleware ----
app.use(helmet()); // sets secure HTTP headers
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(hpp()); // protects against HTTP parameter pollution
app.use(xss()); // sanitizes user input against XSS
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use('/api', apiLimiter);

// ---- Health check (used by CI/CD + hosting platform) ----
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ---- Routes ----
const API = '/api/v1';
app.use(`${API}/auth`, require('./routes/auth.routes'));
app.use(`${API}/products`, require('./routes/product.routes'));
app.use(`${API}/inventory`, require('./routes/inventory.routes'));
app.use(`${API}/warehouses`, require('./routes/warehouse.routes'));
app.use(`${API}/categories`, require('./routes/category.routes'));
app.use(`${API}/brands`, require('./routes/brand.routes'));
app.use(`${API}/orders`, require('./routes/order.routes'));
app.use(`${API}/sellers`, require('./routes/seller.routes'));
app.use(`${API}/vendors`, require('./routes/vendor.routes'));
app.use(`${API}/purchases`, require('./routes/purchase.routes'));
app.use(`${API}/vendor-returns`, require('./routes/vendorReturn.routes'));
app.use(`${API}/return-requests`, require('./routes/returnRequest.routes'));
app.use(`${API}/vendor-credit-notes`, require('./routes/vendorCreditNote.routes'));
app.use(`${API}/users`, require('./routes/user.routes'));
app.use(`${API}/settings`, require('./routes/settings.routes'));
app.use(`${API}/shipments`, require('./routes/shipment.routes'));
app.use(`${API}/storefront`, require('./routes/storefront.routes'));
app.use(`${API}/cart`, require('./routes/cart.routes'));
app.use(`${API}/wishlist`, require('./routes/wishlist.routes'));
app.use(`${API}/addresses`, require('./routes/address.routes'));
app.use(`${API}/offers`, require('./routes/offer.routes'));
app.use(`${API}/reviews`, require('./routes/review.routes'));
app.use(`${API}/notifications`, require('./routes/notification.routes'));

// ---- 404 + error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
