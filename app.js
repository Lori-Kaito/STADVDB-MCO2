document.addEventListener('DOMContentLoaded', () => {
    
// --- 1. MOCK DATA (Updated to match MCO2-Schema.sql) ---
const mockFlightData = [
    { 
        id: 1, 
        origin_code: 'MNL', 
        destination_code: 'CEB', 
        departure_time: '2025-12-25 10:00:00',
        available_seats: 150, 
        status: 'SCHEDULED' 
    },
    { 
        id: 2, 
        origin_code: 'MNL', 
        destination_code: 'DVO', 
        departure_time: '2025-12-26 14:00:00',
        available_seats: 100, 
        status: 'SCHEDULED' 
    },
    { 
        id: 3, 
        origin_code: 'CEB', 
        destination_code: 'NRT', 
        departure_time: '2025-12-27 09:30:00',
        available_seats: 1,     // Low inventory for race condition test
        status: 'SCHEDULED' 
    }
];
    let mockActiveHolds = [];
    let holdIdCounter = 0; 
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- GET HTML ELEMENTS ---
    const flightListDiv = document.getElementById('flight-list');
    const holdForm = document.getElementById('hold-form');
    const messageArea = document.getElementById('message-area');
    const holdsListDiv = document.getElementById('holds-list');

    // --- BOOKING FUNCTIONS ---
async function fetchFlights() {
    console.log('Pretending to fetch flights from API...');
    await sleep(500); 

    try {
        const flights = mockFlightData; 
        flightListDiv.innerHTML = ''; 

        flights.forEach(flight => {
            const flightCard = document.createElement('div');
            flightCard.className = 'flight-card';
            
            // Date formatting to make it look nice
            const dateObj = new Date(flight.departure_time);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            flightCard.innerHTML = `
                <h3>Flight #${flight.id}: ${flight.origin_code} ➝ ${flight.destination_code}</h3>
                <p>Departure: <strong>${dateStr}</strong></p>
                <p>Status: <span style="color:green">${flight.status}</span></p>
                <p><strong>Available Seats: ${flight.available_seats}</strong></p>
            `;
            flightListDiv.appendChild(flightCard);
        });
    } catch (error) {
        flightListDiv.innerHTML = '<p>Error loading flights.</p>';
    }
}

    async function handleHoldSubmit(event) {
        event.preventDefault(); 
        const flightId = document.getElementById('flight-id').value;
        const seatsToHold = parseInt(document.getElementById('seats').value, 10);
        const flight = mockFlightData.find(f => f.id == flightId);

        messageArea.textContent = 'Holding seat...';
        messageArea.className = '';
        await sleep(500); 

        if (!flight) {
            messageArea.textContent = `Failed: Flight ID ${flightId} not found.`;
            messageArea.className = 'message-error';
        } else if (flight.capacity >= seatsToHold) {
            flight.capacity -= seatsToHold;
            const newHold = {
                id: holdIdCounter++,
                flightId: flight.id,
                flightOrigin: flight.origin,
                flightDest: flight.destination,
                seats: seatsToHold,
                expiresAt: Date.now() + (1 * 60 * 1000) 
            };
            mockActiveHolds.push(newHold);
            
            messageArea.textContent = `Success! Hold ID ${newHold.id} created.`;
            messageArea.className = 'message-success';
            
            fetchFlights(); 
            renderMyHolds();
        } else {
            messageArea.textContent = `Failed: Not enough seats available for Flight ${flightId}. Only ${flight.capacity} left.`;
            messageArea.className = 'message-error';
        }
    }

    function renderMyHolds() {
        holdsListDiv.innerHTML = ''; 
        if (mockActiveHolds.length === 0) {
            holdsListDiv.innerHTML = '<p>You have no active holds.</p>';
            return;
        }
        mockActiveHolds.forEach(hold => {
            const card = document.createElement('div');
            card.className = 'hold-card';
            const timeLeft = Math.round((hold.expiresAt - Date.now()) / 1000);
            card.innerHTML = `
                <div class="hold-card-info">
                    <h3>Hold ID: ${hold.id} (Flight ${hold.flightId})</h3>
                    <p>${hold.seats} seats on ${hold.flightOrigin} to ${hold.flightDest}</p>
                    <p class="hold-timer">Expires in: ${timeLeft > 0 ? timeLeft : 0} seconds</p>
                </div>
                <div class="hold-actions">
                    <button class="btn-confirm" data-hold-id="${hold.id}">Confirm Ticket</button>
                    <button class="btn-cancel" data-hold-id="${hold.id}">Cancel Hold</button>
                </div>
            `;
            holdsListDiv.appendChild(card);
        });
    }

    function handleHoldsListClick(event) {
        const holdId = event.target.dataset.holdId;
        if (!holdId) return; 

        if (event.target.classList.contains('btn-confirm')) {
            mockActiveHolds = mockActiveHolds.filter(h => h.id != holdId);
            messageArea.textContent = `Success! Ticket confirmed for Hold ID ${holdId}.`;
            messageArea.className = 'message-success';
            renderMyHolds();
        }

        if (event.target.classList.contains('btn-cancel')) {
            const hold = mockActiveHolds.find(h => h.id == holdId);
            if (hold) {
                const flight = mockFlightData.find(f => f.id == hold.flightId);
                if (flight) {
                    flight.capacity += hold.seats;
                }
                mockActiveHolds = mockActiveHolds.filter(h => h.id != holdId);
                
                messageArea.textContent = `Hold ID ${holdId} was cancelled. Seats released.`;
                messageArea.className = '';
                renderMyHolds();
                fetchFlights(); 
            }
        }
    }
    
    // Timer to update hold expirations
    setInterval(() => {
        let needsRender = false;
        const now = Date.now();
        mockActiveHolds.forEach(hold => {
            if (now > hold.expiresAt) {
                const flight = mockFlightData.find(f => f.id == hold.flightId);
                if (flight) {
                    flight.capacity += hold.seats;
                }
                needsRender = true;
            }
        });

        const unexpiredHolds = mockActiveHolds.filter(h => now < h.expiresAt);
        if (unexpiredHolds.length !== mockActiveHolds.length) {
            needsRender = true;
        }
        mockActiveHolds = unexpiredHolds;

        if (needsRender) {
            renderMyHolds();
            fetchFlights();
        }
    }, 1000); 

    // --- INITIAL PAGE LOAD ---
    holdForm.addEventListener('submit', handleHoldSubmit);
    holdsListDiv.addEventListener('click', handleHoldsListClick);
    fetchFlights();
    renderMyHolds();
});