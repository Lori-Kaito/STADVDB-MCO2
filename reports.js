document.addEventListener('DOMContentLoaded', () => {

    // Get references to the HTML elements
    const capacityDiv = document.getElementById('report-capacity');
    const revenueDiv = document.getElementById('report-revenue');
    const conversionDiv = document.getElementById('report-conversion');

    // --- MOCK DATA FOR REPORTS ---
    const mockCapacityReport = [
        { flight: 'MNL-CEB', sold: 80, capacity: 100 },
        { flight: 'MNL-DAV', sold: 50, capacity: 150 },
        { flight: 'CEB-TKY', sold: 199, capacity: 200 }
    ];
    const mockRevenueReport = [
        { flight: 'MNL-CEB', revenue: 160000 },
        { flight: 'MNL-DAV', revenue: 125000 },
        { flight: 'CEB-TKY', revenue: 1592000 }
    ];
    const mockConversionReport = {
        total_holds: 520,
        total_tickets: 390,
        conversion_rate: 0.75 // 75%
    };

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- FUNCTIONS TO LOAD REPORTS ---

    async function loadReports() {
        console.log('Pretending to fetch reports from API...');
        await sleep(500);
        
        // --- Render Capacity Report ---
        capacityDiv.innerHTML = ''; 
        const capacityTable = document.createElement('table');
        capacityTable.innerHTML = `
            <thead>
                <tr>
                    <th>Flight</th>
                    <th>Sold</th>
                    <th>Capacity</th>
                    <th>Load %</th>
                </tr>
            </thead>
            <tbody>
                ${mockCapacityReport.map(item => `
                    <tr>
                        <td>${item.flight}</td>
                        <td>${item.sold}</td>
                        <td>${item.capacity}</td>
                        <td>${((item.sold / item.capacity) * 100).toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        capacityDiv.appendChild(capacityTable);


        // --- Render Revenue Report ---
        revenueDiv.innerHTML = ''; 
        const revenueTable = document.createElement('table');
        revenueTable.innerHTML = `
            <thead>
                <tr>
                    <th>Flight</th>
                    <th>Total Revenue (PHP)</th>
                </tr>
            </thead>
            <tbody>
                ${mockRevenueReport.map(item => `
                    <tr>
                        <td>${item.flight}</td>
                        <td>${item.revenue.toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        revenueDiv.appendChild(revenueTable);


        // --- Render Conversion Report ---
        conversionDiv.innerHTML = '';
        const conversionRatePercent = (mockConversionReport.conversion_rate * 100).toFixed(1);
        conversionDiv.innerHTML = `
            <h3>${conversionRatePercent}%</h3>
            <p>Based on <strong>${mockConversionReport.total_tickets} tickets</strong> converted from <strong>${mockConversionReport.total_holds} holds</strong>.</p>
        `;
    }

    // --- INITIAL PAGE LOAD ---
    loadReports();
});