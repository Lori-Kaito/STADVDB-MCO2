document.addEventListener('DOMContentLoaded', () => {

    // --- STATE MANAGEMENT ---
    // We keep a local list of holds just for the UI display
    let activeHolds = []; 

    // --- GET HTML ELEMENTS ---
    const flightListDiv = document.getElementById('flight-list');
    const holdForm = document.getElementById('hold-form');
    const messageArea = document.getElementById('message-area');
    const holdsListDiv = document.getElementById('holds-list');

    // --- FETCH FLIGHTS ---
    async function fetchFlights() {
        console.log('Fetching flights from Real API...');
        try {
            // Call the Backend API
            const response = await fetch('http://localhost:3000/api/flights');
            
            if (!response.ok) throw new Error('Failed to fetch flights');

            const flights = await response.json();
            
            // Clear the "Loading..." text
            flightListDiv.innerHTML = ''; 

            if (flights.length === 0) {
                flightListDiv.innerHTML = '<p>No flights found in database.</p>';
                return;
            }

            flights.forEach(flight => {
                const flightCard = document.createElement('div');
                flightCard.className = 'flight-card';
                
                // Format the date nicely
                const dateObj = new Date(flight.departure_time);
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                // Set color based on status
                const statusColor = flight.status === 'SCHEDULED' ? 'green' : 'red';

                flightCard.innerHTML = `
                    <h3>Flight #${flight.id}: ${flight.origin_code} ➝ ${flight.destination_code}</h3>
                    <p>Departure: <strong>${dateStr}</strong></p>
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
            // Call the Backend API
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
                // SUCCESS:
                messageArea.textContent = `Success! Hold ID: ${result.hold_id}`;
                messageArea.className = 'message-success';
                
                // 1. Refresh the flight list (to see available seats go down)
                fetchFlights(); 

                // 2. Add to our local "My Holds" list for display
                addLocalHold(result.hold_id, flightId, seats);

            } else {
                // FAILURE (e.g. Race Condition / Not enough seats):
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
    // This runs client-side just to show you what you booked
    function addLocalHold(holdId, flightId, seats) {
        const newHold = {
            id: holdId,
            flightId: flightId,
            seats: seats,
            expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes from now
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

            // Added data-id attributes to buttons so we know which hold to click
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

    // --- HANDLE CONFIRM / CANCEL CLICKS ---
    holdsListDiv.addEventListener('click', async (event) => {
        const button = event.target;
        const holdId = button.dataset.id;
        if (!holdId) return; // Clicked something else

        // CONFIRM ACTION
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
                    // Remove from list
                    activeHolds = activeHolds.filter(h => h.id != holdId);
                    renderMyHolds();
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (err) { console.error(err); }
        }

        // CANCEL ACTION
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
                    // Remove from list
                    activeHolds = activeHolds.filter(h => h.id != holdId);
                    renderMyHolds();
                    fetchFlights(); // Update flight list to show seats returned!
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (err) { console.error(err); }
        }
    });

    // --- TIMER UPDATE ---
    // Update the countdown timers every second
    setInterval(() => {
        if (activeHolds.length > 0) {
            renderMyHolds();
        }
    }, 1000);

    // --- INITIAL PAGE LOAD ---
    holdForm.addEventListener('submit', handleHoldSubmit);
    
    // Load flights immediately
    fetchFlights();
});