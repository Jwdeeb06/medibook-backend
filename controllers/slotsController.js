const { db } = require('../config/db');

// GET /api/slots?doctor_id=1&service_id=2&date=2026-05-20
// Returns available time slots for a doctor on a given date
exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { doctor_id, service_id, date } = req.query;

    if (!service_id || !date) {
      return res.status(400).json({ error: 'service_id and date are required' });
    }

    // Get service duration
    const [services] = await db.query(
      'SELECT duration_minutes FROM services WHERE id = ? AND is_active = TRUE',
      [service_id]
    );
    if (services.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const duration = services[0].duration_minutes;

    // Get day of week (0=Sun, 1=Mon, ... 6=Sat)
    const dayOfWeek = new Date(date).getDay();

    // Build doctor query
    let doctorIds = [];
    if (doctor_id) {
      doctorIds = [parseInt(doctor_id)];
    } else {
      // Any available doctor — get all who offer this service
      const [docs] = await db.query(
        `SELECT d.id FROM doctors d
         INNER JOIN doctor_services ds ON ds.doctor_id = d.id
         WHERE ds.service_id = ? AND d.is_active = TRUE`,
        [service_id]
      );
      doctorIds = docs.map(d => d.id);
    }

    if (doctorIds.length === 0) {
      return res.json({ slots: [] });
    }

    // For each doctor get their schedule + existing bookings
    const allSlots = [];

    for (const docId of doctorIds) {
      // Get doctor's schedule for this day
      const [schedules] = await db.query(
        `SELECT start_time, end_time FROM schedules
         WHERE doctor_id = ? AND day_of_week = ? AND is_available = TRUE`,
        [docId, dayOfWeek]
      );

      if (schedules.length === 0) continue; // Doctor doesn't work this day

      const { start_time, end_time } = schedules[0];

      // Get existing bookings for this doctor on this date
      const [existingBookings] = await db.query(
        `SELECT start_time, end_time FROM bookings
         WHERE doctor_id = ? AND booking_date = ? AND status NOT IN ('cancelled')`,
        [docId, date]
      );

      // Generate slots
      const slots = generateSlots(start_time, end_time, duration, existingBookings, docId, date);
      allSlots.push(...slots);
    }

    // If "any doctor" mode, merge and deduplicate by time
    const result = doctor_id
      ? allSlots
      : mergeSlots(allSlots);

    res.json({ date, slots: result, total: result.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/slots/available-days?doctor_id=1&service_id=2&month=2026-05
exports.getAvailableDays = async (req, res, next) => {
  try {
    const { doctor_id, service_id, month } = req.query;

    if (!service_id || !month) {
      return res.status(400).json({ error: 'service_id and month are required' });
    }

    // Get working days for the doctor(s)
    let doctorIds = [];
    if (doctor_id) {
      doctorIds = [parseInt(doctor_id)];
    } else {
      const [docs] = await db.query(
        `SELECT d.id FROM doctors d
         INNER JOIN doctor_services ds ON ds.doctor_id = d.id
         WHERE ds.service_id = ? AND d.is_active = TRUE`,
        [service_id]
      );
      doctorIds = docs.map(d => d.id);
    }

    if (doctorIds.length === 0) {
      return res.json({ available_days: [] });
    }

    // Get all working days of week across all relevant doctors
    const [schedules] = await db.query(
      `SELECT DISTINCT day_of_week FROM schedules
       WHERE doctor_id IN (?) AND is_available = TRUE`,
      [doctorIds]
    );

    const workingDays = schedules.map(s => s.day_of_week);

    // Generate all dates in the month that match working days
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const today = new Date().toISOString().split('T')[0];

    const availableDays = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      if (dateStr < today) continue; // Skip past dates

      const dayOfWeek = new Date(dateStr).getDay();
      if (workingDays.includes(dayOfWeek)) {
        availableDays.push(dateStr);
      }
    }

    res.json({ month, available_days: availableDays });
  } catch (error) {
    next(error);
  }
};

// Helper: generate time slots
function generateSlots(startTime, endTime, duration, existingBookings, doctorId, date) {
  const slots = [];

  const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const toTimeStr = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const startMins = toMinutes(startTime);
  const endMins = toMinutes(endTime);

  for (let current = startMins; current + duration <= endMins; current += duration) {
    const slotStart = toTimeStr(current);
    const slotEnd = toTimeStr(current + duration);

    // Check if this slot conflicts with any existing booking
    const isBooked = existingBookings.some(booking => {
      const bookStart = toMinutes(booking.start_time.slice(0, 5));
      const bookEnd = toMinutes(booking.end_time.slice(0, 5));
      return current < bookEnd && current + duration > bookStart;
    });

    slots.push({
      start_time: slotStart,
      end_time: slotEnd,
      doctor_id: doctorId,
      is_available: !isBooked,
      date,
    });
  }

  return slots;
}

// Helper: when "any doctor" — merge slots and mark available if ANY doctor is free
function mergeSlots(allSlots) {
  const timeMap = {};
  for (const slot of allSlots) {
    const key = slot.start_time;
    if (!timeMap[key]) {
      timeMap[key] = { ...slot, available_doctor_ids: [] };
    }
    if (slot.is_available) {
      timeMap[key].available_doctor_ids.push(slot.doctor_id);
      timeMap[key].is_available = true;
    }
  }
  return Object.values(timeMap).sort((a, b) => a.start_time.localeCompare(b.start_time));
}
