require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { sendError } = require('./utils/responseHandler');

// Initialize Express app
const app = express();

// Set up security headers
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['Content-Disposition']
  })
);

// HTTP request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
const { apiLimiter } = require('./middleware/rateLimiter.middleware');
app.use('/api', apiLimiter);

// Root & Health check endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Trova API'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Route definitions
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/companies', require('./routes/company.routes'));
app.use('/api/employees', require('./routes/employee.routes'));
app.use('/api/grades', require('./routes/grade.routes'));
app.use('/api/payroll', require('./routes/payroll.routes'));
app.use('/api/compliance', require('./routes/compliance.routes'));
app.use('/api/billing', require('./routes/billing.routes'));
app.use('/api/constants', require('./routes/constant.routes'));
app.use('/api/copilot', require('./middleware/auth.middleware').protect, require('./middleware/roles.middleware').checkCompanyStatus, require('./middleware/roles.middleware').checkFeatureAccess('ai_copilot'), (req, res) => {
  res.status(200).json({ success: true, message: 'AI Copilot mock endpoint' });
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Send clean error response
  return sendError(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : null);
});

// Start server only when run directly (not in tests)
if (require.main === module) {
  // Database connection
  connectDB();

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
}

module.exports = app; // Expose for testing
