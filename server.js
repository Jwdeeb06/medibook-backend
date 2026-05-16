const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MediBook API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/users',    require('./routes/userRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/admins',   require('./routes/adminRoutes'));
app.use('/api/doctors',  require('./routes/doctorRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

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
