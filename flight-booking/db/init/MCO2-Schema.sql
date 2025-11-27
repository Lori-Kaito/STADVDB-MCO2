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

-- TRANSACTIONS
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

-- PAYMENTS (Revenue Report)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'COMPLETED'
);