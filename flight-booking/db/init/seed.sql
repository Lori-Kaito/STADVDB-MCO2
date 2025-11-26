-- To reset database:
-- type to CMD: docker-compose down -v
-- then type: docker-compose up --build

-- ==========================================
-- SEED DATA FOR FLIGHT BOOKING (LARGE SCALE)
-- ==========================================

-- 1. AIRPORTS
INSERT INTO airports (code, city, country) VALUES
('MNL', 'Manila', 'Philippines'),
('CEB', 'Cebu', 'Philippines'),
('DVO', 'Davao', 'Philippines'),
('NRT', 'Tokyo Narita', 'Japan'),
('SIN', 'Singapore', 'Singapore'),
('HKG', 'Hong Kong', 'China');

-- 2. AIRCRAFTS
INSERT INTO aircrafts (model, total_capacity) VALUES
('Airbus A320', 150),   -- id = 1
('Boeing 737', 100),    -- id = 2
('Boeing 777', 300);    -- id = 3

-- 3. ROUTES
INSERT INTO routes (origin_code, destination_code, base_price, estimated_duration) VALUES
('MNL', 'CEB', 3000.00, INTERVAL '1 hour 15 minutes'),   -- id = 1
('MNL', 'DVO', 3500.00, INTERVAL '1 hour 45 minutes'),   -- id = 2
('CEB', 'NRT', 15000.00, INTERVAL '4 hours 30 minutes'), -- id = 3
('MNL', 'SIN', 12000.00, INTERVAL '3 hours 40 minutes'), -- id = 4
('MNL', 'HKG', 9500.00, INTERVAL '2 hours 15 minutes');  -- id = 5

-- 4. FLIGHT INSTANCES (BULK GENERATION)
-- we generate flights for the next 30 days.

-- Route 1 (MNL-CEB): Daily at 10:00 AM
INSERT INTO flight_instances (route_id, aircraft_id, departure_time, status)
SELECT 1, 1, (CURRENT_DATE + (i || ' days')::interval + '10:00:00'::time), 'SCHEDULED'
FROM generate_series(1, 30) i;

-- Route 2 (MNL-DVO): Daily at 2:00 PM
INSERT INTO flight_instances (route_id, aircraft_id, departure_time, status)
SELECT 2, 1, (CURRENT_DATE + (i || ' days')::interval + '14:00:00'::time), 'SCHEDULED'
FROM generate_series(1, 30) i;

-- Route 3 (CEB-NRT): Daily at 9:30 AM (Boeing 737)
INSERT INTO flight_instances (route_id, aircraft_id, departure_time, status)
SELECT 3, 2, (CURRENT_DATE + (i || ' days')::interval + '09:30:00'::time), 'SCHEDULED'
FROM generate_series(1, 30) i;

-- Route 4 (MNL-SIN): Every other day at 6:00 PM (Boeing 777)
INSERT INTO flight_instances (route_id, aircraft_id, departure_time, status)
SELECT 4, 3, (CURRENT_DATE + (i || ' days')::interval + '18:00:00'::time), 'SCHEDULED'
FROM generate_series(1, 30, 2) i;

-- 5. SEAT INVENTORY (AUTOMATIC GENERATION)
-- This query automatically finds ALL flights created above and generates seats for them.
-- If we created 100 flights, this will generate 15,000 seat rows instantly.

INSERT INTO flight_seat_inventory (flight_instance_id, seat_number, seat_class, status, price)
SELECT
    fi.id AS flight_instance_id,
    gs.seat_no::text AS seat_number,
    'ECONOMY' AS seat_class,
    'AVAILABLE' AS status,
    r.base_price AS price
FROM flight_instances fi
JOIN routes r    ON fi.route_id = r.id
JOIN aircrafts a ON fi.aircraft_id = a.id
CROSS JOIN LATERAL generate_series(1, a.total_capacity) AS gs(seat_no);

-- 6. DEMO DATA (Specific Scenarios)

-- Scenario A: Make the FIRST flight of Route 3 (CEB-NRT) almost full for Race Condition testing
-- We use a subquery to find the very first flight ID for route 3
UPDATE flight_seat_inventory
SET status = 'SOLD'
WHERE flight_instance_id = (SELECT id FROM flight_instances WHERE route_id = 3 ORDER BY departure_time LIMIT 1)
  AND id NOT IN (
      SELECT id
      FROM flight_seat_inventory
      WHERE flight_instance_id = (SELECT id FROM flight_instances WHERE route_id = 3 ORDER BY departure_time LIMIT 1)
      ORDER BY id
      LIMIT 1 -- Leave only 1 seat available
  );