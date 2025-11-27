document.addEventListener('DOMContentLoaded', () => {

    // --- STATE MANAGEMENT ---
    let activeHolds = []; 
    let allFlights = []; // Store flight details globally

    // --- GET HTML ELEMENTS ---
    const flightListDiv = document.getElementById('flight-list');
    const holdForm = document.getElementById('hold-form');
    const messageArea = document.getElementById('message-area');
    const holdsListDiv = document.getElementById('holds-list');
    
    // Modal Elements
    const modal = document.getElementById('ticket-modal');
    const closeBtn = document.querySelector('.close-btn');
    const downloadBtn = document.getElementById('btn-download-pdf');

    // --- FETCH FLIGHTS ---
    async function fetchFlights() {
        console.log('Fetching flights from Real API...');
        try {
            const response = await fetch('http://localhost:3000/api/flights');
            if (!response.ok) throw new Error('Failed to fetch flights');

            allFlights = await response.json(); // Store globally for the ticket generation
            const flights = allFlights;
            
            flightListDiv.innerHTML = ''; 

            if (flights.length === 0) {
                flightListDiv.innerHTML = '<p>No flights found in database.</p>';
                return;
            }

            flights.forEach(flight => {
                const flightCard = document.createElement('div');
                flightCard.className = 'flight-card';
                
                const dateObj = new Date(flight.departure_time);
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const statusColor = flight.status === 'SCHEDULED' ? 'green' : 'red';
                const priceStr = flight.base_price ? parseFloat(flight.base_price).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : 'N/A';

                // --- DURATION FORMATTING ---
                let durationHtml = 'N/A';
                if (flight.estimated_duration) {
                    const { hours, minutes } = flight.estimated_duration;
                    const parts = [];

                    if (hours) parts.push(`<strong>${hours} hour${hours !== 1 ? 's' : ''}</strong>`);
                    if (minutes) parts.push(`<strong>${minutes} minute${minutes !== 1 ? 's' : ''}</strong>`);
                    
                    if (parts.length > 0) durationHtml = parts.join(' and ');
                }

                flightCard.innerHTML = `
                    <h3>Flight #${flight.id}: ${flight.origin_code} ➝ ${flight.destination_code}</h3>
                    <p><strong>Aircraft: ${flight.aircraft_model || 'Unknown'}</strong></p>
                    <p>Departure: <strong>${dateStr}</strong></p>
                    <p>Duration: ${durationHtml}</p>
                    <p>Price: <strong>${priceStr}</strong></p>
                    <p>Status: <span style="color:${statusColor}">${flight.status}</span></p>
                    <p><strong>Available Seats: ${flight.available_seats}</strong></p>
                `;
                flightListDiv.appendChild(flightCard);
            });
        } catch (error) {
            console.error(error);
            flightListDiv.innerHTML = '<p style="color:red">Error loading flights. Is the backend running?</p>';
        }
    }

    // --- HOLD SEAT ---
    async function handleHoldSubmit(event) {
        event.preventDefault(); 
        const flightId = document.getElementById('flight-id').value;
        const seats = document.getElementById('seats').value;

        messageArea.textContent = 'Processing...';
        messageArea.className = '';

        try {
            const response = await fetch('http://localhost:3000/api/hold', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    flight_id: flightId, 
                    seats_to_hold: seats,
                    user: 'customer_web' 
                })
            });

            const result = await response.json();

            if (result.success) {
                messageArea.textContent = `Success! Hold ID: ${result.hold_id}`;
                messageArea.className = 'message-success';
                fetchFlights(); 
                addLocalHold(result.hold_id, flightId, seats);
            } else {
                messageArea.textContent = `Failed: ${result.message}`;
                messageArea.className = 'message-error';
            }
        } catch (error) {
            console.error(error);
            messageArea.textContent = 'Network Error. Is the backend running?';
            messageArea.className = 'message-error';
        }
    }

    // --- UI HELPER: Manage "My Active Holds" List ---
    function addLocalHold(holdId, flightId, seats) {
        const newHold = {
            id: holdId,
            flightId: flightId,
            seats: seats,
            expiresAt: Date.now() + (5 * 60 * 1000) 
        };
        activeHolds.push(newHold);
        renderMyHolds();
    }

    function renderMyHolds() {
        holdsListDiv.innerHTML = ''; 
        if (activeHolds.length === 0) {
            holdsListDiv.innerHTML = '<p>You have no active holds.</p>';
            return;
        }

        activeHolds.forEach(hold => {
            const card = document.createElement('div');
            card.className = 'hold-card';
            
            const timeLeft = Math.round((hold.expiresAt - Date.now()) / 1000);
            const timerText = timeLeft > 0 ? `${timeLeft} seconds` : "Expired";

            card.innerHTML = `
                <div class="hold-card-info">
                    <h3>Hold ID: ${hold.id} (Flight ${hold.flightId})</h3>
                    <p>${hold.seats} seat(s)</p>
                    <p class="hold-timer">Expires in: ${timerText}</p>
                </div>
                <div class="hold-actions">
                    <button class="btn-confirm" data-id="${hold.id}">Confirm</button>
                    <button class="btn-cancel" data-id="${hold.id}">Cancel</button>
                </div>
            `;
            holdsListDiv.appendChild(card);
        });
    }

    // --- HANDLE CONFIRM (SHOW TICKET) / CANCEL ---
    holdsListDiv.addEventListener('click', async (event) => {
        const button = event.target;
        const holdId = button.dataset.id;
        if (!holdId) return; 

        // CONFIRM
        if (button.classList.contains('btn-confirm')) {
            messageArea.textContent = 'Confirming ticket...';
            try {
                const res = await fetch('http://localhost:3000/api/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hold_id: holdId })
                });
                const data = await res.json();
                
                if (data.success) {
                    messageArea.textContent = `Success! Ticket confirmed for Hold ID: ${holdId}`;
                    messageArea.className = 'message-success';
                    
                    // --- GENERATE DIGITAL TICKET ---
                    const hold = activeHolds.find(h => h.id == holdId);
                    const flight = allFlights.find(f => f.id == hold.flightId);
                    
                    if (flight) {
                        const dateObj = new Date(flight.departure_time);
                        document.getElementById('ticket-origin').textContent = flight.origin_code;
                        document.getElementById('ticket-dest').textContent = flight.destination_code;
                        document.getElementById('ticket-flight-id').textContent = `FL-${flight.id}`;
                        document.getElementById('ticket-date').textContent = dateObj.toLocaleDateString();
                        document.getElementById('ticket-time').textContent = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        document.getElementById('ticket-aircraft').textContent = flight.aircraft_model || 'Aircraft';
                        document.getElementById('ticket-seats').textContent = hold.seats;
                        document.getElementById('ticket-id').textContent = `#${holdId}`;
                        
                        // Show Modal
                        modal.style.display = 'flex';
                    }

                    activeHolds = activeHolds.filter(h => h.id != holdId);
                    renderMyHolds();
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (err) { console.error(err); }
        }

        // CANCEL
        if (button.classList.contains('btn-cancel')) {
            messageArea.textContent = 'Canceling booking...';
            try {
                const res = await fetch('http://localhost:3000/api/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hold_id: holdId })
                });
                const data = await res.json();
                
                if (data.success) {
                    messageArea.textContent = `Booking cancelled. Seats released.`;
                    messageArea.className = 'message-success';
                    activeHolds = activeHolds.filter(h => h.id != holdId);
                    renderMyHolds();
                    fetchFlights(); 
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (err) { console.error(err); }
        }
    });

    // --- MODAL HANDLERS ---
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });
    downloadBtn.addEventListener('click', () => {
        window.print(); 
    });

    // --- INITIAL LOAD ---
    setInterval(() => {
        if (activeHolds.length > 0) {
            renderMyHolds();
        }
    }, 1000);

    holdForm.addEventListener('submit', handleHoldSubmit);
    fetchFlights();
});