# Petal & Bean POS (MERN)

The same pastel café till you already had, now running on **MongoDB + Express + React + Node**.
Sales, customers, products and stock are saved in a real database, so nothing disappears when you refresh or log out.

- Same look: your original `styles.css` is used unchanged (the few new rules for Inventory are in a clearly marked block at the bottom).
- Same features: PIN login, products + search + categories, bill with 5 % tax, customer details, Cash/Card with change, receipt + print, Customers tab, Sales history tab, CSV/PDF export, mobile layout.
- New: **Inventory** (stock levels, restock, add/edit products) and a server that checks every bill.

---

## 1. Quick start

You need **Node.js 18+** (https://nodejs.org) and **MongoDB** (local or free Atlas, see below).

```bash
cd petal-and-bean-pos
npm run setup      # installs server + client, creates server/.env
npm run dev        # starts API (port 5000) + React app (port 5173)
```

Open **http://localhost:5173** and log in:

Open **http://localhost:5173** and log in with the admin email and PIN you set in `server/.env`
(`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PIN`; choose your own **before** the first run).

On the very first start the server creates this login and the 18 original products automatically.
Once you are in, add staff accounts and change your own PIN from the app. 

### MongoDB option A: on your computer
Install MongoDB Community (https://www.mongodb.com/try/download/community) and make sure it is running.
The default `MONGODB_URI=mongodb://127.0.0.1:27017/petal-and-bean` in `server/.env` already points to it.

## 2. Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time install (both apps) + creates `server/.env` |
| `npm run dev` | Development: API with auto-restart + React with hot reload |
| `npm run build` then `npm start` | Production: Express serves the API **and** the built React app on one port (5000) |
| `npm run seed` | Adds the login user + any missing original products (safe to repeat, never overwrites stock or PIN) |
| `npm run seed:reset` | **Deletes** products, bills, customers and stock history, then re-seeds (login user is kept) |
| `npm test` | API tests (needs a MongoDB; uses a separate `petal-and-bean-test` database) |

## 3. Project structure

```
petal-and-bean-pos/
├── server/                      Express + MongoDB API
│   ├── .env.example             All settings, documented
│   ├── src/
│   │   ├── index.js             Start-up (connect DB → seed → listen)
│   │   ├── app.js               Express app, security headers, serves React build in production
│   │   ├── config/              env.js (settings), db.js (connection)
│   │   ├── models/              User, Product, Customer, Order, Counter, StockMovement
│   │   ├── routes/index.js      Every endpoint in one readable list
│   │   ├── controllers/         Request handlers
│   │   ├── services/            Business rules: order creation, stock, customer totals
│   │   ├── middleware/          auth (JWT), validation (zod), error handling
│   │   ├── schemas.js           Input rules for every endpoint
│   │   ├── constants/categories.js
│   │   └── seed/                First-run data (the 18 original products live in products.js)
│   └── tests/api.test.js
├── client/                      React (Vite)
│   ├── index.html               Fonts + favicon (same as before)
│   └── src/
│       ├── styles/styles.css    Your original CSS + marked additions
│       ├── components/          LoginScreen, SellView, CheckoutModal, Receipt, HistoryView, InventoryView…
│       ├── context/             Auth, Toast, shop settings/products
│       ├── hooks/useCart.js
│       ├── api/                 fetch wrapper + one function per endpoint
│       └── utils/               formatting, CSV/PDF export
├
└── scripts/setup.js
```

## 4. How the old code maps to the new

| Before | Now |
|---|---|
| `js/data.js` → login, shop name/address/phone, tax, currency | `server/.env` (served to the app by `GET /api/settings`) |
| `js/data.js` → `PRODUCTS`, `CATEGORIES` | `Product` collection (seeded from `server/src/seed/products.js`) · categories in `server/src/constants/categories.js` |
| `state.sales` | `Order` collection |
| `state.customers` | `Customer` collection (matched by phone digits, like before) |
| `state.billCounter` | `Counter` collection → `PB-0001, PB-0002 …` keep counting across days |
| `index.html` + `app.js` | React components, same class names and DOM, so the CSS applies unchanged |
| `lib/jspdf*.js` | npm packages `jspdf@2.5.1` and `jspdf-autotable@3.8.2` (same versions as your bundled files) |

To change the shop name, tax or currency: edit `server/.env` and restart the server.
To change the original product list: edit it in the **Inventory** tab (or `seed/products.js` before first run).

## 5. Things that behave differently on purpose

1. **Data is saved.** The logout popup used to warn that everything is deleted; it now says everything is saved (it only warns if the *current unpaid bill* has items).
2. **Refreshing the page keeps you logged in** (token kept for the browser tab, expires after 12 h).
3. **Totals are calculated by the server** from database prices, so they can't be changed from the browser. The screen shows the same numbers as before.
4. **Stock is enforced.** Selling reduces stock; sold-out items are greyed out; the server refuses to oversell even if two tills sell the last item together.
5. **Login is checked by the server**, PIN stored hashed (bcrypt), 5 wrong PINs lock the account for 5 minutes. The PIN is no longer in browser code.
6. **Sales history loads 50 bills at a time** ("Load more"); exports always include everything.
7. CSV export prefixes cells that start with `=`, `@` etc. with `'` so a customer name can't run as a spreadsheet formula.

## 6. API (all under `/api`, everything except login needs `Authorization: Bearer <token>`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{ email, pin }` → `{ token, user }` |
| GET | `/auth/me`, `/settings` | current user · shop name, tax, currency, categories |
| GET/POST | `/products` | list (menu) · create (admin) |
| PATCH/DELETE | `/products/:id` | edit · remove from menu (admin; old bills keep their data) |
| GET | `/inventory`, `/inventory/movements` | stock overview + summary · stock history |
| POST | `/inventory/:id/adjust` | `{ delta }` or `{ set }` (admin) |
| GET | `/customers` | list (`?search=`) |
| POST | `/orders` | `{ customer:{name,phone}, items:[{productId,qty}], payment:{method,cashReceived?|cardLast4?} }` |
| GET | `/orders`, `/orders/:id` | history (`?page&limit&search&method&from&to`, `?all=true` for exports) |
| GET | `/sales/summary` | bills, total, cash, card |

## 7. Deploying

Simplest: one service (e.g. Render, Railway, a VPS) running `npm run build && npm start`, with environment variables
`NODE_ENV=production`, `MONGODB_URI` (Atlas), and a long random `JWT_SECRET`
(`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). **The server refuses to start in production without `JWT_SECRET`.**
Change `SEED_ADMIN_PIN` before the first production start (or change it later in the database).

If you host the React app separately (Netlify/Vercel): set `VITE_API_URL` to the API address when building the client and `CLIENT_URL` to the site address on the server.

## 8. Troubleshooting

- **"Could not connect to MongoDB"** → MongoDB isn't running, or `MONGODB_URI` is wrong (Atlas: check the IP allow-list).
- **Port 5000 busy (macOS AirPlay uses it)** → set `PORT=5001` in `server/.env` and `VITE_PROXY_TARGET=http://localhost:5001` when running the client.
- **"Can't reach the server"** on the login screen → the API isn't running; use `npm run dev` (starts both).
- **Forgot the PIN** → run `npm run seed:reset`, or delete the user in MongoDB and restart (the seed recreates it from `.env`).
- PDF exports use the built-in PDF font, so non-Latin names (e.g. Urdu script) won't render in the PDF. Same limitation as the original; CSV handles them fine.
