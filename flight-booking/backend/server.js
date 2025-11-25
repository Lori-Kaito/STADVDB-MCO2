// backend/server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Connect to Database
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db_primary',
    database: process.env.DB_NAME || 'flight_booking',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

// --- API ENDPOINTS ---

// GET FLIGHTS
app.get('/api/flights', async (req, res) => {
    try {
        const query = `
            SELECT 
                fi.id, 
                r.origin_code, 
                r.destination_code,
                r.base_price,
                r.estimated_duration,
                fi.departure_time, 
                fi.status,
                a.model as aircraft_model,
                (SELECT COUNT(*) FROM flight_seat_inventory fsi 
                 WHERE fsi.flight_instance_id = fi.id AND fsi.status = 'AVAILABLE') as available_seats
            FROM flight_instances fi
            JOIN routes r ON fi.route_id = r.id
            JOIN aircrafts a ON fi.aircraft_id = a.id
            ORDER BY fi.departure_time;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// HOLD SEATS (The Race Condition Logic)
app.post('/api/hold', async (req, res) => {
    const { flight_id, seats_to_hold, user } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Start Transaction

        // Create the booking record
        const bookingQuery = `
            INSERT INTO bookings (user_username, flight_instance_id, expires_at) 
            VALUES ($1, $2, NOW() + INTERVAL '5 minutes') 
            RETURNING id;
        `;
        const bookingRes = await client.query(bookingQuery, [user || 'guest', flight_id]);
        const bookingId = bookingRes.rows[0].id;

        // Lock N available seats (The "Secret Sauce")
        // This grabs specific seat rows and locks them so no one else can take them
        const lockQuery = `
            WITH locked_seats AS (
                SELECT id, price 
                FROM flight_seat_inventory
                WHERE flight_instance_id = $1 
                  AND status = 'AVAILABLE'
                LIMIT $2
                FOR UPDATE SKIP LOCKED
            )
            UPDATE flight_seat_inventory
            SET status = 'HELD'
            FROM locked_seats
            WHERE flight_seat_inventory.id = locked_seats.id
            RETURNING flight_seat_inventory.id, flight_seat_inventory.price;
        `;
        const lockRes = await client.query(lockQuery, [flight_id, seats_to_hold]);

        // Check if we got enough seats
        if (lockRes.rows.length < seats_to_hold) {
            // Failed! Not enough seats. Rollback everything.
            await client.query('ROLLBACK');
            return res.json({ success: false, message: 'Not enough seats available!' });
        }

        // Create Booking Items
        for (const seat of lockRes.rows) {
            await client.query(
                `INSERT INTO booking_items (booking_id, flight_seat_inventory_id, price_at_booking) VALUES ($1, $2, $3)`,
                [bookingId, seat.id, seat.price]
            );
        }

        await client.query('COMMIT'); // Success! Save changes.
        res.json({ success: true, hold_id: bookingId, message: 'Seats held successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Transaction failed' });
    } finally {
        client.release();
    }
});

// REPORTS (Using the Views from the Schema)
app.get('/api/reports/capacity', async (req, res) => {
    try {
        // Query the View: view_report_flight_capacity
        const { rows } = await pool.query('SELECT * FROM view_report_flight_capacity');
        res.json(rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/reports/revenue', async (req, res) => {
    try {
        // Query the View: view_report_revenue
        const { rows } = await pool.query('SELECT * FROM view_report_revenue');
        res.json(rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/reports/conversion', async (req, res) => {
    try {
        // Query the View: view_report_conversion
        const { rows } = await pool.query('SELECT * FROM view_report_conversion');
        // The view returns 1 row with stats
        res.json(rows[0]);
    } catch (err) { res.status(500).send(err.message); }
});

// CONFIRM BOOKING (Convert Hold to Ticket)
app.post('/api/confirm', async (req, res) => {
    const { hold_id } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Mark Booking as CONFIRMED
        await client.query(
            `UPDATE bookings SET status = 'CONFIRMED' WHERE id = $1`,
            [hold_id]
        );

        // Mark Inventory Seats as SOLD
        await client.query(
            `UPDATE flight_seat_inventory 
             SET status = 'SOLD' 
             WHERE id IN (SELECT flight_seat_inventory_id FROM booking_items WHERE booking_id = $1)`,
            [hold_id]
        );

        // Record Payment (Optional but good for Revenue Report)
        // calculate the total price from the booking items
        await client.query(
            `INSERT INTO payments (booking_id, amount, status)
             SELECT $1, SUM(price_at_booking), 'COMPLETED'
             FROM booking_items WHERE booking_id = $1`,
            [hold_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Ticket confirmed!' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Confirmation failed' });
    } finally {
        client.release();
    }
});

// CANCEL HOLD (Release Seats)
app.post('/api/cancel', async (req, res) => {
    const { hold_id } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Mark Booking as CANCELLED
        await client.query(
            `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`,
            [hold_id]
        );

        // Release Seats back to AVAILABLE
        await client.query(
            `UPDATE flight_seat_inventory 
             SET status = 'AVAILABLE' 
             WHERE id IN (SELECT flight_seat_inventory_id FROM booking_items WHERE booking_id = $1)`,
            [hold_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Booking cancelled. Seats released.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Cancellation failed' });
    } finally {
        client.release();
    }
});

app.listen(port, () => {
    console.log(`Backend API listening at http://localhost:${port}`);
});