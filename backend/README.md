# Backend - API & Server Services

## Purpose
This folder will contain the backend infrastructure for Detour. It handles user authentication, booking logic, payment processing, notifications, and data management. Can be built with either Supabase (managed) or Node.js (custom), depending on complexity and scalability needs.

## Tech Stack Options

### Option 1: Supabase (Recommended for MVP)
- **Database**: PostgreSQL (managed)
- **Authentication**: Built-in Auth system
- **API**: Auto-generated REST & GraphQL APIs
- **Real-time**: WebSocket subscriptions
- **Storage**: File uploads
- **Functions**: PostgreSQL triggers or Edge Functions

### Option 2: Node.js Custom Backend
- **Framework**: Express.js or Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Passport.js or custom
- **Task Queue**: Bull (Redis-based job queue)
- **Caching**: Redis
- **Deployment**: AWS, DigitalOcean, Render, or Railway

## Project Structure (When Implemented)

### Supabase Structure
```
backend/
├── supabase/
│   ├── migrations/         # Database schema migrations
│   ├── functions/          # Edge Functions (TypeScript)
│   ├── policies/           # Row-Level Security (RLS)
│   └── .env.local
└── README.md
```

### Node.js Structure
```
backend/
├── src/
│   ├── routes/            # API endpoints
│   ├── controllers/        # Business logic
│   ├── models/            # Database models
│   ├── middleware/        # Auth, validation, error handling
│   ├── services/          # External integrations (Razorpay, etc.)
│   ├── utils/             # Helper functions
│   ├── db/                # Database configuration
│   └── server.js          # Entry point
├── migrations/            # Database migrations
├── tests/                 # Unit & integration tests
├── .env
├── package.json
└── docker-compose.yml     # Local development database
```

## Key Features (To Build)
- User registration & authentication (travelers & guides)
- Guide profile management & search indexing
- Booking creation, cancellation, rescheduling
- Payment processing with Razorpay
- Review & rating system
- Messaging system with real-time updates
- Notification service (email, SMS, push)
- Admin moderation APIs
- Analytics & reporting

## Database Schema (PostgreSQL)
```
- users (travelers & guides)
- guides (profile, languages, availability, pricing)
- bookings (reservations, status, payments)
- reviews (ratings, feedback)
- messages (chat history)
- payments (transaction records)
- notifications (logs, delivery status)
```

## API Endpoints (Example)
```
GET    /api/guides           # Search guides
GET    /api/guides/:id       # Get guide details
POST   /api/bookings         # Create booking
PUT    /api/bookings/:id     # Update booking
POST   /api/payments         # Process payment
GET    /api/messages         # Get chat history
POST   /api/reviews          # Submit review
```

## Getting Started (When Ready)

### Supabase
```bash
npm install -g supabase
supabase init
supabase start
```

### Node.js
```bash
npm init -y
npm install express prisma dotenv cors
npx prisma init
npm run dev
```

## Deployment
- **Supabase**: Built-in hosted (no deployment needed)
- **Node.js**: Deploy to Vercel, Railway, Render, or AWS
