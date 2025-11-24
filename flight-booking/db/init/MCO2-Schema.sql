-- STATIC INFRASTRUCTURE
CREATE TABLE airports (
    code CHAR(3) PRIMARY KEY, -- e.g., MNL, CEB
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL
);

CREATE TABLE aircrafts (
    id SERIAL PRIMARY KEY,
    model VARCHAR(50) NOT NULL, -- e.g., Boeing 737
    total_capacity INT NOT NULL
);

-- FLIGHT DEFINITIONS
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    origin_code CHAR(3) REFERENCES airports(code),
    destination_code CHAR(3) REFERENCES airports(code),
    base_price DECIMAL(10, 2) NOT NULL, -- Base price for logic calculations
    estimated_duration INTERVAL
);

-- FLIGHT INSTANCES (The "Actual" Flights)
CREATE TABLE flight_instances (
    id SERIAL PRIMARY KEY,
    route_id INT REFERENCES routes(id),
    aircraft_id INT REFERENCES aircrafts(id),
    departure_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED', -- SCHEDULED, CANCELLED, DEPARTED
    -- Constraint to ensure aircraft isn't double booked would go here
    UNIQUE (aircraft_id, departure_time)
);

-- THE INVENTORY (RACE CONDITIONS)
-- Instead of a simple "count", we track every seat to allow row-level locking.
CREATE TABLE flight_seat_inventory (
    id BIGSERIAL PRIMARY KEY,
    flight_instance_id INT REFERENCES flight_instances(id),
    seat_number VARCHAR(5), -- e.g., "1A", "22F"
    seat_class VARCHAR(20) DEFAULT 'ECONOMY', -- ECONOMY, BUSINESS
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, HELD, SOLD
    price DECIMAL(10, 2) NOT NULL,
    
    -- Optimized Index for Finding Available Seats quickly
    -- This is crucial for the "Get N seats" query
    CONSTRAINT unique_seat_per_flight UNIQUE (flight_instance_id, seat_number)
);
CREATE INDEX idx_inventory_search ON flight_seat_inventory(flight_instance_id, status);

-- 5. TRANSACTIONS
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_username VARCHAR(100) NOT NULL, -- From your login screen
    flight_instance_id INT REFERENCES flight_instances(id),
    status VARCHAR(20) DEFAULT 'HELD', -- HELD, CONFIRMED, EXPIRED, CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL -- Crucial for releasing holds
);

CREATE TABLE booking_items (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    flight_seat_inventory_id BIGINT REFERENCES flight_seat_inventory(id),
    price_at_booking DECIMAL(10, 2) NOT NULL
);

-- 6. PAYMENTS (Revenue Report)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'COMPLETED'
);


-- -- PSEUDO-SQL for the "Hold Seat" Endpoint

-- BEGIN;

-- -- 1. Create the booking record
-- INSERT INTO bookings (user_username, flight_instance_id, expires_at) 
-- VALUES ('customer', 1, NOW() + INTERVAL '5 minutes') 
-- RETURNING id INTO v_booking_id;

-- -- 2. LOCK N available seats (Batch Operation)
-- -- This is the magic query. It finds N available seats and locks them instantly.
-- WITH locked_seats AS (
--     SELECT id 
--     FROM flight_seat_inventory
--     WHERE flight_instance_id = 1 
--       AND status = 'AVAILABLE'
--     LIMIT 5 -- (User requested 5 seats)
--     FOR UPDATE SKIP LOCKED
-- )
-- UPDATE flight_seat_inventory
-- SET status = 'HELD'
-- FROM locked_seats
-- WHERE flight_seat_inventory.id = locked_seats.id
-- RETURNING flight_seat_inventory.id, price;

-- -- 3. If update count < 5, ROLLBACK (Not enough seats);
-- -- 4. Else, Insert into booking_items and COMMIT;

-- COMMIT;

-- Reports & Visualization Schema (OLAP)

CREATE OR REPLACE VIEW view_report_flight_capacity AS
SELECT 
    r.origin_code || '-' || r.destination_code AS flight_route,
    fi.id AS flight_instance_id,
    COUNT(CASE WHEN fsi.status = 'SOLD' THEN 1 END) as sold_count,
    COUNT(fsi.id) as total_capacity,
    (COUNT(CASE WHEN fsi.status = 'SOLD' THEN 1 END)::float / NULLIF(COUNT(fsi.id),0)) * 100 as load_percentage
FROM flight_instances fi
JOIN routes r ON fi.route_id = r.id
JOIN flight_seat_inventory fsi ON fi.id = fsi.flight_instance_id
GROUP BY r.origin_code, r.destination_code, fi.id;

CREATE OR REPLACE VIEW view_report_revenue AS
SELECT 
    r.origin_code || '-' || r.destination_code AS flight_route,
    COALESCE(SUM(p.amount), 0) as total_revenue
FROM payments p
RIGHT JOIN bookings b ON p.booking_id = b.id
RIGHT JOIN flight_instances fi ON b.flight_instance_id = fi.id
JOIN routes r ON fi.route_id = r.id
WHERE p.status = 'COMPLETED' OR p.status IS NULL
GROUP BY r.origin_code, r.destination_code;

CREATE OR REPLACE VIEW view_report_conversion AS
SELECT 
    COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as total_tickets,
    COUNT(*) as total_holds,
    (COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END)::float / NULLIF(COUNT(*),0)) * 100 as conversion_rate
FROM bookings;