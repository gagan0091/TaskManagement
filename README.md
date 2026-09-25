# Task Management API (Multi-Tenant, Role-Based Inventory & Production Tracking)

A Node.js / Express / MongoDB backend for assigning tasks that consume raw
materials to build products, with a full audit trail — plus a server-rendered
EJS frontend that talks to that same JSON API. The system is **multi-tenant**:
every organization's users, materials, products, tasks and inventory history
are fully isolated from every other organization's.

## Architecture

```
Browser  --->  EJS frontend (views/ + src/web/*)  --->  fetch()  --->  JSON API (/api/*)  --->  MongoDB
```

The EJS frontend is a **client of the API, nothing more**. Every page in
`views/` is rendered from data fetched via `src/web/apiClient.js`, which makes
plain HTTP calls to this app's own `/api/*` routes. The frontend never
imports a model or controller directly.

This means:
- The `/api/*` contract stays usable by Postman, a mobile app, or a future
  React/Vue frontend, independent of how the EJS pages are built.
- If you swap the frontend technology later, only `views/` and `src/web/`
  need to change — `src/controllers`, `src/models`, `src/routes` stay as-is.

### Authentication — JWT in an HTTP-only cookie (no server-side session)

Auth is fully stateless. There is **no `express-session` and no in-memory
session store** anywhere in the app:

- On login/register, the API signs a JWT and the response sets it as an
  `httpOnly` cookie (`token`), so it can't be read or tampered with from
  client-side JavaScript:
  ```js
  res.cookie("token", jwtToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: false // set true once served over HTTPS
  });
  ```
- Every request — from the EJS frontend *or* an external API client — is
  authenticated the same way: `authMiddleware.js` reads the JWT from
  **either** the `token` cookie **or** an `Authorization: Bearer <token>`
  header, verifies it, loads the user, and attaches
  `req.user = { userId, name, email, role, organization }`.
- The frontend's own `webAuth.js` does the same cookie check before
  rendering a page, and a small global middleware in `app.js` decodes the
  cookie on every request so `res.locals.currentUser` is always available to
  EJS views (this is what fixed the earlier `currentUser is not defined`
  error in `header.ejs`).
- Logout simply calls `res.clearCookie("token")`.
- Because there's no session store, the login **survives a `nodemon`
  restart** — the token is just a cookie in the browser and stays valid
  until it expires, instead of being wiped along with an in-memory session.

`src/web/apiClient.js` (the frontend's only way of talking to the API) reads
`req.cookies.token` and forwards it as `Authorization: Bearer <token>` on
every call it makes to `/api/*` — it no longer reads anything from a session
object.

## Multi-Tenant Organizations

Every `User`, `RawMaterial`, `Product`, `Task` and `InventoryTransaction`
document belongs to exactly one **Organization**, via a required
`organization` field. Every query in every controller is scoped with
`organization: req.user.organization`, so one organization can never read,
update, or delete another organization's data — even if an ID is guessed.

### Registration is self-service — there is no seed script

`POST /api/auth/register` (and the `/register` page) does **not** create a
plain user anymore. It creates a **brand-new Organization** and makes the
person registering its **admin**, in one MongoDB transaction:

```
name, email, password, organizationName  --->  new Organization + new admin User (same org)
```

That admin then adds their team from the **Users** page
(`POST /api/users` / `/admin/users/new`): the admin picks each teammate's
email and sets their password directly, and they're created as a normal
`user` inside the **admin's own organization** — there's no separate signup
step for them and no "join an existing org" flow.

Because every account is created this way, **the old `npm run seed:admin`
script has been removed** — the first admin for an organization is simply
whoever registers it.

### What's organization-scoped

| Model | Notes |
|---|---|
| `User` | Every user (admin or regular) belongs to one organization |
| `RawMaterial` | Inventory items are per-organization |
| `Product` | Recipes (raw material per unit) are per-organization |
| `Task` | Creation, listing, status updates, delete+revert — all organization-scoped |
| `InventoryTransaction` | Every stock movement's ledger row records which organization it belongs to |

`Task` visibility: an **admin** sees every task in their organization; a
regular **user** only sees tasks assigned to them, and only within their own
organization.

## Features

- **Auth**: JWT in an HTTP-only cookie (register/login/profile, `/api/auth`),
  usable as a cookie by the browser or as a Bearer token by any other client.
- **Roles**: `admin` / `user`, always scoped to one organization. Registering
  creates a new organization + its admin; the admin creates every other user
  in that organization.
- **Inventory**: raw materials with stock, unit, minimum stock level and
  cost/unit, all scoped to the owning organization. Every stock change
  (add / adjust / consumed by a task / reverted) is written to an
  append-only ledger (`InventoryTransaction`, also organization-scoped) —
  nothing changes stock without a matching history row.
- **Products**: each has a "recipe" (`materials[]`) of raw material required
  per one unit produced, scoped to the product's organization.
- **Tasks**: an admin creates a task — pick a product, a quantity, and assign
  it to a user **in the same organization**. The exact raw material needed
  is calculated, checked, and atomically deducted from inventory **in the
  same MongoDB transaction** as the task's creation (assignee lookup, product
  lookup, stock check, stock deduction, inventory-transaction history, and
  the task itself all happen together — any failure rolls back everything),
  with a snapshot of what was allocated stored on the task (`materialsUsed`)
  so it's not affected by later recipe changes.
- **Status flow**: `pending → in-progress → completed`, only movable forward,
  changeable by the assigned user or an admin. Completing a task adds the
  produced units to the product's stock.
- **Delete & revert**: if an admin deletes a task that isn't completed yet,
  the raw material it had allocated is added back to inventory in one
  transaction, with a `TASK_REVERT` ledger entry. Completed tasks can't be
  deleted (the material was genuinely used).
- **History & analytics** (admin only, scoped to their own organization):
  full inventory ledger (filterable by material/task/date), plus aggregate
  views — inventory usage, production by product, raw-material usage by
  product, and task counts by status/user.
- **Request logging**: every request (API or frontend) is logged to the
  console with method, path, status code, timing and who made it.

## Project Structure

```
src/
  app.js                 - wires everything together
  config/                - db connection, shared constants
  controllers/            \
  middleware/               API layer (unchanged contract)
  models/                    - User, Organization, RawMaterial, Product,
  routes/                     Task, InventoryTransaction
  services/inventoryService.js  - the ONLY place stock is changed
  web/                    - EJS frontend layer
    apiClient.js          - calls this app's own /api/* over HTTP, using
                            the same JWT cookie the browser already has
    middleware/           - cookie-based auth/role guards for the browser
    routes/               - one router per resource, rendering views
    router.js             - combines them, mounted at "/"
views/                    - EJS templates (Bootstrap 5 via CDN)
public/                   - static assets (css)
server.js                 - entrypoint
```

## Setup

1. Copy the env file and fill in real values:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Run with Docker (recommended — sets up MongoDB as a replica set for you)

MongoDB **transactions require a replica set**, so `docker-compose.yml` starts
Mongo as a single-node replica set automatically.

```bash
docker compose up --build
```

### Run locally without Docker

You'll need MongoDB running as a replica set. Easiest with Docker for just the DB:
```bash
docker run -d --name mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec mongo mongosh --eval "rs.initiate()"
```
Then in `.env`, set:
```
MONGO_URI=mongodb://localhost:27017/task_management?directConnection=true
```
And run:
```bash
npm start   # or: npm run dev
```

Open **http://localhost:5000/register** to create your organization and its
first admin account, then **http://localhost:5000/login** to sign in. `GET /`
stays a plain JSON health check for monitoring/API consumers. Call
**http://localhost:5000/api/...** directly (with a `Bearer` token, or the
`token` cookie) to use the API from anything other than the browser.

## Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Port the server listens on |
| `MONGO_URI` | MongoDB connection string (replica set required) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Signs the auth token stored in the `token` cookie |
| `APP_BASE_URL` | Where the frontend calls its own API (loopback URL) |

There is no admin-seeding env block anymore — register the first account
through `/register` and it becomes the admin of a brand-new organization.

## API Reference

All `/api/*` routes except register/login require the JWT, either as the
`token` cookie (set automatically after login/register) or as
`Authorization: Bearer <token>`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create a new organization + its admin (`name`, `email`, `password`, `organizationName`) |
| POST | `/api/auth/login` | public | Login, sets the `token` cookie and returns the JWT |
| GET | `/api/auth/profile` | any | Current user's profile |
| GET/POST | `/api/users` | admin | List / create users in your own organization |
| PATCH | `/api/users/:id/role` | admin | Change a user's role (same organization only) |
| GET/POST | `/api/inventory` | admin | List / create raw materials (own organization) |
| GET/PUT/DELETE | `/api/inventory/:id` | admin | Read / edit / delete a material (own organization) |
| POST | `/api/inventory/:id/add-stock` | admin | Add stock (ledger: `STOCK_IN`) |
| POST | `/api/inventory/:id/adjust-stock` | admin | Signed correction (ledger: `ADJUSTMENT`) |
| GET | `/api/inventory/history`, `/api/inventory/:id/history` | admin | Stock ledger (own organization) |
| GET/POST | `/api/products` | any / admin | List products / create (admin), own organization |
| GET/PUT/DELETE | `/api/products/:id` | any / admin | Read / edit / delete (admin for write), own organization |
| GET/POST | `/api/tasks` | any / admin | List (role- and organization-scoped) / create (admin) |
| GET/PUT/DELETE | `/api/tasks/:id` | any / admin | Read / edit / delete+revert (admin for write) |
| PATCH | `/api/tasks/:id/status` | assignee or admin | Move status forward |
| GET | `/api/analytics/inventory` \| `/production` \| `/material-usage` \| `/tasks` | admin | Aggregate reports for your own organization |

## Frontend Routes (EJS)

| Route | Who | Purpose |
|---|---|---|
| `/register` | anyone | Create a new organization + become its admin |
| `/login`, `/logout` | anyone / logged-in | Sign in / clear the auth cookie |
| `/dashboard` | any logged-in user | Recent tasks (+ low stock & task stats for admin) |
| `/tasks`, `/tasks/:id` | any (scoped by role + organization) | Task list / detail, start/complete buttons |
| `/tasks/new`, `/tasks/:id/edit` | admin | Create / edit a task |
| `/products`, `/products/:id` | any | Product list / recipe detail |
| `/products/new`, `/products/:id/edit` | admin | Create / edit a product & its recipe |
| `/admin/materials` and sub-routes | admin | Inventory CRUD, add/adjust stock, history |
| `/admin/users` | admin | User list, create teammates, change role |
| `/admin/analytics` | admin | All 4 analytics reports on one page |

## Notes

- Stock is **only** ever changed through `src/services/inventoryService.js`,
  so the ledger and the live quantity can never drift apart. It also now
  requires `organization` on every call, so every `InventoryTransaction`
  row is correctly tied to the organization that made the movement.
- Set the `token` cookie's `secure` flag to `true` once the app is served
  over HTTPS (it's `false` for local HTTP development).