// ADD this export to your existing bookingController.js at the bottom

exports.requestReschedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { preferred_date, preferred_time, reason } = req.body;

    const [rows] = await db.query(`
      SELECT b.*, s.name AS service_name, d.name AS doctor_name,
             COALESCE(u.name, b.guest_name) AS customer_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      WHERE b.id = ?`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // Only the booking owner can request reschedule
    if (booking.user_id !== req.user.id)
      return res.status(403).json({ error: 'Not your booking' });

    // Only pending or confirmed bookings can be rescheduled
    if (!['pending', 'confirmed'].includes(booking.status))
      return res.status(400).json({ error: 'Cannot reschedule a cancelled or completed booking' });

    // Add note about reschedule request
    const rescheduleNote = `[RESCHEDULE REQUEST] Patient requested new time: ${preferred_date || 'flexible'} ${preferred_time ? 'at ' + preferred_time : ''}. Reason: ${reason || 'Not specified'}`;

    await db.query(
      'UPDATE bookings SET notes = CONCAT(COALESCE(notes, ""), ?) WHERE id = ?',
      ['\n' + rescheduleNote, id]
    );

    // Notify all admins
    const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
    for (const admin of admins) {
      await createNotification(admin.id,
        `🔄 Reschedule Request — Booking #${id}`,
        `${booking.customer_name} is requesting to reschedule their ${booking.service_name} appointment${preferred_date ? ' to ' + preferred_date : ''}.`,
        'booking'
      );
    }

    res.json({ message: 'Reschedule request sent to admin' });
  } catch (error) { next(error); }
};
