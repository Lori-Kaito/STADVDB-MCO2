// backend/server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// --- CONNECTION 1: PRIMARY DB (For Transactions) ---
const poolPrimary = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db_primary', // Connects to the main DB
    database: process.env.DB_NAME || 'flight_booking',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

// --- CONNECTION 2: REPORTS DB (For Analytics) ---
const poolReports = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_REPORTS_HOST || 'db_reports', // Connects to the reports DB
    database: 'flight_reports', // Matches the env var in docker-compose for db_reports
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

// ==========================================
// TRANSACTIONAL ENDPOINTS (Use poolPrimary)
// ==========================================

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
        const { rows } = await poolPrimary.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// HOLD SEATS
app.post('/api/hold', async (req, res) => {
    const { flight_id, seats_to_hold, user } = req.body;
    const client = await poolPrimary.connect();

    try {
        await client.query('BEGIN'); 

        const bookingQuery = `
            INSERT INTO bookings (user_username, flight_instance_id, expires_at) 
            VALUES ($1, $2, NOW() + INTERVAL '5 minutes') 
            RETURNING id;
        `;
        const bookingRes = await client.query(bookingQuery, [user || 'guest', flight_id]);
        const bookingId = bookingRes.rows[0].id;

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

        if (lockRes.rows.length < seats_to_hold) {
            await client.query('ROLLBACK');
            return res.json({ success: false, message: 'Not enough seats available!' });
        }

        for (const seat of lockRes.rows) {
            await client.query(
                `INSERT INTO booking_items (booking_id, flight_seat_inventory_id, price_at_booking) VALUES ($1, $2, $3)`,
                [bookingId, seat.id, seat.price]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, hold_id: bookingId, message: 'Seats held successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Transaction failed' });
    } finally {
        client.release();
    }
});

// CONFIRM BOOKING
app.post('/api/confirm', async (req, res) => {
    const { hold_id } = req.body;
    const client = await poolPrimary.connect();

    try {
        await client.query('BEGIN');
        await client.query(`UPDATE bookings SET status = 'CONFIRMED' WHERE id = $1`, [hold_id]);
        await client.query(`UPDATE flight_seat_inventory SET status = 'SOLD' WHERE id IN (SELECT flight_seat_inventory_id FROM booking_items WHERE booking_id = $1)`, [hold_id]);
        await client.query(`INSERT INTO payments (booking_id, amount, status) SELECT $1, SUM(price_at_booking), 'COMPLETED' FROM booking_items WHERE booking_id = $1`, [hold_id]);
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

// CANCEL HOLD
app.post('/api/cancel', async (req, res) => {
    const { hold_id } = req.body;
    const client = await poolPrimary.connect();

    try {
        await client.query('BEGIN');
        await client.query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`, [hold_id]);
        await client.query(`UPDATE flight_seat_inventory SET status = 'AVAILABLE' WHERE id IN (SELECT flight_seat_inventory_id FROM booking_items WHERE booking_id = $1)`, [hold_id]);
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

// ==========================================
// ANALYTICAL ENDPOINTS (Use poolReports)
// ==========================================

app.get('/api/reports/capacity', async (req, res) => {
    try {
        // Use poolReports to fetch from the specific Reports Database
        const { rows } = await poolReports.query('SELECT * FROM view_report_flight_capacity');
        res.json(rows);
    } catch (err) { 
        console.error("Reports DB Error:", err);
        res.status(500).send(err.message); 
    }
});

app.get('/api/reports/revenue', async (req, res) => {
    try {
        const { rows } = await poolReports.query('SELECT * FROM view_report_revenue');
        res.json(rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/reports/conversion', async (req, res) => {
    try {
        const { rows } = await poolReports.query('SELECT * FROM view_report_conversion');
        res.json(rows[0] || {});
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(port, () => {
    console.log(`Backend API listening at http://localhost:${port}`);
});