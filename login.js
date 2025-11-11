document.addEventListener('DOMContentLoaded', () => {
    
    const customerBtn = document.getElementById('login-customer');
    const adminBtn = document.getElementById('login-admin');
    const message = document.getElementById('login-message');

    // Customer Login
    customerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        message.textContent = 'Logging in as customer...';
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    });

    // Admin Login
    adminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // A simple check for our "admin"
        if (document.getElementById('username').value === 'admin') {
            message.textContent = 'Logging in as admin...';
            setTimeout(() => {
                window.location.href = 'reports.html';
            }, 500);
        } else {
            message.textContent = 'Hint: Try username "admin" for the admin page.';
        }
    });
});