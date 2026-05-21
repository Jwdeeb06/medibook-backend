const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MediBook API is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/users',         require('./routes/userRoutes'));
app.use('/api/services',      require('./routes/serviceRoutes'));
app.use('/api/doctors',       require('./routes/doctorRoutes'));
app.use('/api/bookings',      require('./routes/bookingRoutes'));
app.use('/api/admins',        require('./routes/adminRoutes'));
app.use('/api/settings',      require('./routes/settingsRoutes'));
app.use('/api/slots',         require('./routes/slotRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/patients',  require('./routes/patientRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const startServer = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🏥 MediBook server running on http://localhost:${PORT}`);
  });
};

startServer();
