document.addEventListener('DOMContentLoaded', () => {

    // Get references to the HTML elements
    const capacityDiv = document.getElementById('report-capacity');
    const revenueDiv = document.getElementById('report-revenue');
    const conversionDiv = document.getElementById('report-conversion');

    // --- MOCK DATA FOR REPORTS ---
    // Matches: view_report_flight_capacity
    const mockCapacityReport = [
        { flight_route: 'MNL-CEB', sold_count: 80, total_capacity: 100, load_percentage: 80.0 },
        { flight_route: 'MNL-DAV', sold_count: 50, total_capacity: 150, load_percentage: 33.3 },
        { flight_route: 'CEB-TKY', sold_count: 199, total_capacity: 200, load_percentage: 99.5 }
    ];

    // Matches: view_report_revenue
    const mockRevenueReport = [
        { flight_route: 'MNL-CEB', total_revenue: 160000.00 },
        { flight_route: 'MNL-DAV', total_revenue: 125000.50 },
        { flight_route: 'CEB-TKY', total_revenue: 1592000.00 }
    ];

    // Matches: view_report_conversion
    const mockConversionReport = {
        total_tickets: 390,
        total_holds: 520,
        conversion_rate: 75.0
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
                <th>Flight Route</th>
                <th>Sold</th>
                <th>Capacity</th>
                <th>Load %</th>
            </tr>
        </thead>
        <tbody>
            ${mockCapacityReport.map(item => `
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
            ${mockRevenueReport.map(item => `
                <tr>
                    <td>${item.flight_route}</td>
                    <td>${item.total_revenue.toLocaleString()}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    revenueDiv.appendChild(revenueTable);


        // --- Render Conversion Report ---
        conversionDiv.innerHTML = '';
        conversionDiv.innerHTML = `
        <h3>${mockConversionReport.conversion_rate}%</h3>
        <p>Based on <strong>${mockConversionReport.total_tickets} tickets</strong> converted from <strong>${mockConversionReport.total_holds} holds</strong>.</p>
    `;
}

    // --- INITIAL PAGE LOAD ---
    loadReports();
});