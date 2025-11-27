# ✈️ Flight Booking System (MCO2)

A full-stack flight booking application built to handle **high-concurrency** operations. This system prevents double-booking (race conditions) using database row-level locking.

## ✨ Features

* **For Customers:**
    * View flight schedules, aircraft info, and prices.
    * **Hold Seats:** Temporarily reserve a seat.
    * **Confirm:** Pay and convert a hold into a ticket.
    * **Cancel:** Release a held seat back to the inventory.
* **For Admins:**
    * View reports on Flight Capacity, Revenue, and Conversion Rates.
* **Key Tech Feature:** Handles race conditions using PostgreSQL `SKIP LOCKED` to prevent overbooking.

## 🛠️ Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Node.js, Express
* **Database:** PostgreSQL 16
* **Infrastructure:** Docker & Docker Compose
* **Testing:** Apache JMeter

---

## 🚀 How to Run

### Prerequisites
1.  **Install Docker Desktop:** Download it from the official website.
2.  **OPEN Docker Desktop:** Make sure the app is running in the background before you start.

### Steps
1.  **Clone the repository**
    ```bash
    git clone <repo-link>
    cd flight-booking
    ```

2.  **Start the System**
    Run this command to build the backend and set up the database automatically:
    ```bash
    docker-compose up --build
    ```

3.  **Open the App**
    * **Website:** Open `frontend/login.html` in your browser (or use Live Server).
    * **API:** Running at `http://localhost:3000`

---

## 🧪 Load Testing (Race Conditions)

To prove the system handles concurrency (100+ users booking at once):

1.  Ensure the app is running (the database comes seeded with 100+ flights).
2.  Open **Apache JMeter**. (Install this as well if you haven't)
3.  Load the included script: `flight_load_test.jmx`.
4.  Run the test to simulate high traffic and check the generated report.

---

## 👥 Developers

* **[Dlareinnej Jherby Jaime]**
* **[Phoenix Claire De Castro]**
* **[Rahmon Khayle Del Mundo]**