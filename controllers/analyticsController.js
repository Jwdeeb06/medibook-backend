const { db } = require('../config/db');

exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = '30' } = req.query; // days

    // Total revenue
    const [[{ total_revenue }]] = await db.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_revenue
       FROM bookings WHERE status IN ('confirmed', 'completed')
       AND booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [period]
    );

    // Revenue by day (last N days)
    const [revenueByDay] = await db.query(
      `SELECT DATE(booking_date) AS date,
              COALESCE(SUM(total_price), 0) AS revenue,
              COUNT(*) AS bookings
       FROM bookings
       WHERE status IN ('confirmed', 'completed')
         AND booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(booking_date)
       ORDER BY date ASC`,
      [period]
    );

    // Revenue by service
    const [revenueByService] = await db.query(
      `SELECT s.name AS service,
              COUNT(b.id) AS bookings,
              COALESCE(SUM(b.total_price), 0) AS revenue
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.status IN ('confirmed', 'completed')
         AND b.booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY s.id, s.name
       ORDER BY revenue DESC`,
      [period]
    );

    // Revenue by doctor
    const [revenueByDoctor] = await db.query(
      `SELECT d.name AS doctor, d.specialization,
              COUNT(b.id) AS bookings,
              COALESCE(SUM(b.total_price), 0) AS revenue
       FROM bookings b
       JOIN doctors d ON b.doctor_id = d.id
       WHERE b.status IN ('confirmed', 'completed')
         AND b.booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY d.id, d.name, d.specialization
       ORDER BY revenue DESC`,
      [period]
    );

    // Bookings by status
    const [bookingsByStatus] = await db.query(
      `SELECT status, COUNT(*) AS count
       FROM bookings
       WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY status`,
      [period]
    );

    // Busiest days of week
    const [busiestDays] = await db.query(
      `SELECT DAYNAME(booking_date) AS day_name,
              DAYOFWEEK(booking_date) AS day_num,
              COUNT(*) AS bookings
       FROM bookings
       WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND status NOT IN ('cancelled')
       GROUP BY day_name, day_num
       ORDER BY day_num`,
      [period]
    );

    // Busiest hours
    const [busiestHours] = await db.query(
      `SELECT HOUR(start_time) AS hour, COUNT(*) AS bookings
       FROM bookings
       WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND status NOT IN ('cancelled')
       GROUP BY hour
       ORDER BY hour`,
      [period]
    );

    // New patients in period
    const [[{ new_patients }]] = await db.query(
      `SELECT COUNT(*) AS new_patients FROM users
       WHERE role = 'patient'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [period]
    );

    // Cancellation rate
    const [[{ total, cancelled }]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM bookings
       WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [period]
    );
    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : 0;

    res.json({
      period: parseInt(period),
      summary: {
        total_revenue: parseFloat(total_revenue),
        new_patients,
        cancellation_rate: parseFloat(cancellationRate),
        total_bookings: total,
      },
      revenue_by_day: revenueByDay,
      revenue_by_service: revenueByService,
      revenue_by_doctor: revenueByDoctor,
      bookings_by_status: bookingsByStatus,
      busiest_days: busiestDays,
      busiest_hours: busiestHours,
    });
  } catch (error) { next(error); }
};
