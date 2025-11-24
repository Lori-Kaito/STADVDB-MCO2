-- ============================
-- SEED DATA FOR FLIGHT BOOKING
-- ============================

-- 1. AIRPORTS
INSERT INTO airports (code, city, country) VALUES
('MNL', 'Manila', 'Philippines'),
('CEB', 'Cebu', 'Philippines'),
('DVO', 'Davao', 'Philippines'),
('NRT', 'Tokyo Narita', 'Japan');

-- 2. AIRCRAFTS
INSERT INTO aircrafts (model, total_capacity) VALUES
('Airbus A320', 150),   -- id = 1
('Boeing 737', 100);    -- id = 2

-- 3. ROUTES
INSERT INTO routes (origin_code, destination_code, base_price, estimated_duration) VALUES
('MNL', 'CEB', 3000.00, INTERVAL '1 hour 15 minutes'),   -- id = 1
('MNL', 'DVO', 3500.00, INTERVAL '1 hour 45 minutes'),   -- id = 2
('CEB', 'NRT', 15000.00, INTERVAL '4 hours 30 minutes'); -- id = 3

-- 4. FLIGHT INSTANCES
-- These match your mock frontend flights (id 1, 2, 3)
INSERT INTO flight_instances (route_id, aircraft_id, departure_time, status) VALUES
(1, 1, '2025-12-25 10:00:00', 'SCHEDULED'),  -- MNL-CEB
(2, 1, '2025-12-26 14:00:00', 'SCHEDULED'),  -- MNL-DVO
(3, 2, '2025-12-27 09:30:00', 'SCHEDULED');  -- CEB-NRT

-- 5. SEAT INVENTORY
-- Generate seats for each flight based on the aircraft capacity.
-- Seat numbers are "1", "2", ..., total_capacity as text. All start as AVAILABLE.

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

-- OPTIONAL: make flight 3 almost full (only 1 AVAILABLE) for low-inventory demo.
-- Comment out this block if you don't want it.

UPDATE flight_seat_inventory
SET status = 'SOLD'
WHERE flight_instance_id = 3
  AND id NOT IN (
      SELECT id
      FROM flight_seat_inventory
      WHERE flight_instance_id = 3
      ORDER BY id
      LIMIT 1
  );
