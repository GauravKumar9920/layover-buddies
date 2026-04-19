# Web Application - Next.js Full-Stack App

## Purpose
This folder will contain the main web application built with Next.js. It will serve as the full-stack platform where travelers can search and book guides, and student guides can manage their profiles, bookings, and earnings. Features include user authentication, search/filtering, booking management, reviews, messaging, and payment integration.

## Tech Stack
- **Framework**: Next.js (App Router recommended)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth or NextAuth.js
- **Styling**: Tailwind CSS + shadcn/ui (optional component library)
- **State Management**: React Context or Zustand
- **API**: Next.js API Routes
- **Deployment**: Vercel (native Next.js platform)

## Project Structure (When Implemented)
```
webapp/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard/home
│   ├── auth/              # Authentication pages
│   ├── search/            # Guide search & discovery
│   ├── bookings/          # Booking management
│   ├── guides/            # Guide profile pages
│   ├── api/               # API routes
│   └── layout.tsx
├── components/             # Reusable React components
├── lib/                    # Utility functions, API clients
├── public/                # Static assets
├── styles/                # Global CSS
├── .env.local             # Environment variables
├── package.json
├── tsconfig.json
└── next.config.js
```

## Key Features (To Build)
- User registration & authentication (travelers & guides)
- Guide profile discovery with filters (location, price, languages)
- Booking system with calendar & time slots
- Messaging system for guide-traveler communication
- Review & ratings system
- Earnings dashboard for guides
- Payment integration with Razorpay
- Admin dashboard for moderation

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

## Getting Started (When Ready)
```bash
npx create-next-app@latest webapp --typescript --tailwind
cd webapp
npm install
npm run dev
```

## Deployment
Deploy to Vercel with automatic GitHub integration:
```bash
vercel
```
