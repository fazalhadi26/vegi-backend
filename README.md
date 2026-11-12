# Qatar Fresh Veg - Backend REST API Service

Production-ready Node.js + Express.js backend for the Qatar Fresh Veg online vegetable ordering and delivery platform.

## Features
- **Authentication & RBAC**: JWT-based authentication with Customer, Admin, and Delivery personnel roles.
- **Product & Category Management**: Full CRUD, search, filtering by price/category/availability, SKU generation.
- **Perishable Inventory Control**: Batch tracking, expiry dates, supplier delivery logs, and damaged/spoiled waste records.
- **Order Processing**: Live price validation, minimum order requirements, coupon discounting, stock deduction, and status timeline.
- **Qatar Localization**: Currency in QAR, Qatar address schema (Zone, Street, Building, Apartment), +974 phone verification.
- **Admin Dashboard & Analytics**: KPI metrics, sales reporting, best-sellers breakdown, low-stock alerts.
- **Dual Engine Architecture**: Full Mongoose/MongoDB persistence with automatic resilient in-memory storage fallback.

## Default Credentials
- **Admin**: `admin@qatarfreshveg.qa` / `Admin@123456`
- **Customer**: `hamad@qatarfreshveg.qa` / `Customer@123456`
- **Delivery**: `delivery@qatarfreshveg.qa` / `Delivery@123456`

## Quick Start
```bash
cd vegi-backend
npm install
npm start
# Server starts on http://localhost:5000
```

