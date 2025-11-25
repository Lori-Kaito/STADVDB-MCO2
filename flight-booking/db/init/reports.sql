-- Reports & Visualization Schema (OLAP)

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