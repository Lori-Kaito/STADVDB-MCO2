-- Only the tables needed for reports:
-- routes, flight_instances, flight_seat_inventory, bookings, payments

CREATE TABLE IF NOT EXISTS routes (
    id              INT PRIMARY KEY,
    origin_code     CHAR(3),
    destination_code CHAR(3),
    base_price      DECIMAL(10, 2),
    estimated_duration INTERVAL
);

CREATE TABLE IF NOT EXISTS flight_instances (
    id            INT PRIMARY KEY,
    route_id      INT,
    aircraft_id   INT,
    departure_time TIMESTAMP NOT NULL,
    status        VARCHAR(20) DEFAULT 'SCHEDULED'
);

CREATE TABLE IF NOT EXISTS flight_seat_inventory (
    id                 BIGINT PRIMARY KEY,
    flight_instance_id INT,
    seat_number        VARCHAR(5),
    seat_class         VARCHAR(20) DEFAULT 'ECONOMY',
    status             VARCHAR(20) DEFAULT 'AVAILABLE',
    price              DECIMAL(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    id                INT PRIMARY KEY,
    user_username     VARCHAR(100) NOT NULL,
    flight_instance_id INT,
    status            VARCHAR(20) DEFAULT 'HELD',
    created_at        TIMESTAMP,
    expires_at        TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id           INT PRIMARY KEY,
    booking_id   INT,
    amount       DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP,
    status       VARCHAR(20) DEFAULT 'COMPLETED'
);

-- ============================================
-- OLAP Views
-- ============================================

-- Report 1: Flight Capacity
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

-- Report 2: Revenue
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

-- Report 3: Conversion Rate
CREATE OR REPLACE VIEW view_report_conversion AS
SELECT 
    COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as total_tickets,
    COUNT(*) as total_holds,
    (COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END)::float / NULLIF(COUNT(*),0)) * 100 as conversion_rate
FROM bookings;
