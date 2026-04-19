# Technical Documentation

## Purpose
Central repository for technical specifications, architecture decisions, API documentation, database schemas, and system design. Keep this updated as implementation progresses.

## Contents
- System Architecture Overview
- Database Schema Diagrams & Specifications
- API Documentation (endpoints, request/response examples)
- Authentication & Security Specifications
- Integration Guides (Razorpay, Supabase, etc.)
- Deployment & DevOps Documentation
- Performance & Scalability Considerations
- Error Handling & Status Codes
- Data Privacy & Encryption Specifications

## Tech Stack Summary
| Component | Technology |
|-----------|-----------|
| Website | Vite + Tailwind CSS |
| Web App | Next.js |
| Mobile | React Native / Expo |
| Backend | Supabase or Node.js |
| Database | PostgreSQL |
| Payments | Razorpay |
| Hosting | Vercel (webapp), Expo (mobile), Supabase (backend) |

## Database Schema (To Document)
- **users**: travelers, guides, admins
- **guides**: profiles, languages, ratings, availability
- **bookings**: reservations, status tracking, payments
- **reviews**: ratings, feedback, moderation
- **messages**: chat history, real-time sync
- **payments**: transaction logs, refunds
- **notifications**: delivery logs, preferences

## API Endpoints (To Document)
```
Authentication
POST   /auth/register
POST   /auth/login
POST   /auth/logout

Guides
GET    /api/guides              # Search with filters
GET    /api/guides/:id          # Get details
PUT    /api/guides/:id          # Update profile
GET    /api/guides/:id/reviews  # Get reviews

Bookings
POST   /api/bookings            # Create booking
GET    /api/bookings/:id        # Get booking details
PUT    /api/bookings/:id        # Update/cancel
GET    /api/bookings            # List user bookings

Payments
POST   /api/payments/razorpay   # Create payment
POST   /api/payments/verify     # Verify payment

Messages
GET    /api/messages/:booking_id
POST   /api/messages            # Send message
WebSocket /ws/messages          # Real-time

Reviews
POST   /api/reviews             # Submit review
GET    /api/reviews/:guide_id   # Get guide reviews
```

## Security Considerations
- [ ] JWT authentication for API
- [ ] Row-Level Security (RLS) in database
- [ ] Password hashing (bcrypt)
- [ ] Rate limiting on sensitive endpoints
- [ ] HTTPS/TLS for all communications
- [ ] Payment data encryption (Razorpay PCI compliance)
- [ ] Data retention policy
- [ ] Incident logging & monitoring

## Performance & Scalability
- [ ] Database indexing strategy
- [ ] Caching (Redis for frequently accessed data)
- [ ] CDN for static assets
- [ ] Load testing before launch
- [ ] Auto-scaling configuration
- [ ] Database backups & disaster recovery

## Deployment Pipeline
- [ ] GitHub Actions for CI/CD
- [ ] Staging & production environments
- [ ] Database migration strategy
- [ ] Rollback procedures
- [ ] Monitoring & alerting (Sentry, DataDog)
- [ ] Log aggregation (CloudWatch, LogRocket)

## Tools Recommended
- **Documentation**: Notion, Markdown + GitHub
- **API Testing**: Postman, Insomnia
- **Database Design**: DbDiagram.io, Lucidchart
- **Monitoring**: Sentry, DataDog, New Relic
- **Version Control**: GitHub with branch protection

## Key Decisions to Document
- [ ] Authentication method (JWT vs. sessions)
- [ ] Database: Supabase vs. custom Node.js
- [ ] Real-time messaging (WebSocket vs. polling)
- [ ] File storage (Supabase vs. AWS S3)
- [ ] Caching strategy (Redis, CDN)
- [ ] Backup & disaster recovery plan
