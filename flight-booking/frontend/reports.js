document.addEventListener('DOMContentLoaded', () => {

    // Get references to the HTML elements
    const capacityDiv = document.getElementById('report-capacity');
    const revenueDiv = document.getElementById('report-revenue');
    const conversionDiv = document.getElementById('report-conversion');

    // --- FUNCTIONS TO LOAD REPORTS ---

    async function loadReports() {
        console.log('Fetching reports from Real API...');
        
        try {
            // --- Render Capacity Report ---
            // Fetch data from the backend
            const capRes = await fetch('http://localhost:3000/api/reports/capacity');
            
            if (!capRes.ok) throw new Error('Failed to load capacity report');
            
            const capacityReport = await capRes.json();
            
            // Clear "Loading..." text
            capacityDiv.innerHTML = ''; 
            
            // Build the table
            const capacityTable = document.createElement('table');
            capacityTable.innerHTML = `
                <thead>
                    <tr>
                        <th>Flight Route</th>
                        <th>Sold</th>
                        <th>Capacity</th>
                        <th>Load %</th>
                    </tr>
                </thead>
                <tbody>
                    ${capacityReport.map(item => `
                        <tr>
                            <td>${item.flight_route}</td>
                            <td>${item.sold_count}</td>
                            <td>${item.total_capacity}</td>
                            <td>${item.load_percentage}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            capacityDiv.appendChild(capacityTable);


            // --- Render Revenue Report ---
            const revRes = await fetch('http://localhost:3000/api/reports/revenue');
            
            if (!revRes.ok) throw new Error('Failed to load revenue report');
            
            const revenueReport = await revRes.json();

            revenueDiv.innerHTML = ''; 
            const revenueTable = document.createElement('table');
            revenueTable.innerHTML = `
                <thead>
                    <tr>
                        <th>Flight Route</th>
                        <th>Total Revenue (PHP)</th>
                    </tr>
                </thead>
                <tbody>
                    ${revenueReport.map(item => `
                        <tr>
                            <td>${item.flight_route}</td>
                            <td>${parseFloat(item.total_revenue).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            revenueDiv.appendChild(revenueTable);


            // --- Render Conversion Report ---
            const convRes = await fetch('http://localhost:3000/api/reports/conversion');
            
            if (!convRes.ok) throw new Error('Failed to load conversion report');
            
            const conversionReport = await convRes.json();

            conversionDiv.innerHTML = '';
            // Handle case where there might be no bookings yet
            const rate = conversionReport.conversion_rate !== null ? conversionReport.conversion_rate : 0;
            
            conversionDiv.innerHTML = `
                <h3>${rate}%</h3>
                <p>Based on <strong>${conversionReport.total_tickets} tickets</strong> converted from <strong>${conversionReport.total_holds} holds</strong>.</p>
            `;

        } catch (err) {
            console.error("Error loading reports:", err);
            // Show error message
            const errorMessage = `<p style="color:red">Error loading reports. Is the backend running?</p>`;
            if (capacityDiv.innerHTML.includes('Loading')) capacityDiv.innerHTML = errorMessage;
            if (revenueDiv.innerHTML.includes('Loading')) revenueDiv.innerHTML = errorMessage;
            if (conversionDiv.innerHTML.includes('Loading')) conversionDiv.innerHTML = errorMessage;
        }
    }

    // --- INITIAL PAGE LOAD ---
    loadReports();
});