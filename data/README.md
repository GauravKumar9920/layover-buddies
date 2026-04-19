# Data - Database Schemas, Seed Data & Analytics

## Purpose
Store database schemas, migrations, seed data for development/testing, and data-related documentation. This folder helps maintain consistency across development environments and tracks data evolution.

## Contents
- Database Schema Diagrams & SQL
- Database Migration Files
- Seed Data (test users, guides, bookings)
- Data Validation Rules
- Analytics & Reporting Queries
- Data Dictionary
- Backup & Recovery Documentation

## Folder Organization
```
data/
├── schemas/
│   ├── schema-diagram.pdf
│   ├── initial_schema.sql
│   ├── database-tables.md
│   └── data-dictionary.md
│
├── migrations/
│   ├── 001_create_users_table.sql
│   ├── 002_create_guides_table.sql
│   ├── 003_create_bookings_table.sql
│   ├── 004_create_reviews_table.sql
│   ├── 005_create_messages_table.sql
│   └── migration-guide.md
│
├── seed-data/
│   ├── test-users.sql
│   ├── test-guides.sql
│   ├── test-bookings.sql
│   ├── sample-reviews.sql
│   └── README-seed-data.md
│
├── analytics/
│   ├── user-metrics-queries.sql
│   ├── booking-analytics.sql
│   ├── revenue-analytics.sql
│   └── engagement-reports.md
│
└── backups/
    ├── backup-procedures.md
    └── recovery-guide.md
```

## Database Tables Overview (To Document)

### Core Tables
- **users**: All user accounts (travelers, guides, admins)
- **guides**: Guide profiles with details, languages, pricing
- **bookings**: Tours/experiences booked by travelers
- **reviews**: Ratings and feedback from travelers
- **messages**: Private messaging between users
- **payments**: Payment transaction records
- **notifications**: Notification logs & delivery status

### Example Schema Structure
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  user_type ENUM('traveler', 'guide', 'admin'),
  first_name VARCHAR,
  last_name VARCHAR,
  phone VARCHAR,
  profile_image_url VARCHAR,
  bio TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Guides table
CREATE TABLE guides (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  languages JSON,
  experience_years INT,
  hourly_rate DECIMAL,
  bio TEXT,
  availability JSON,
  rating DECIMAL,
  total_reviews INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Bookings table
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  traveler_id UUID REFERENCES users(id),
  guide_id UUID REFERENCES guides(id),
  booking_date DATE,
  duration_hours INT,
  total_price DECIMAL,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Seed Data for Development
Create test data for local development:
- 10-20 test users (travelers)
- 5-10 test guides with profiles
- Sample bookings across different statuses
- Test reviews and ratings
- Sample messages

This allows developers to test functionality without relying on production data.

## Analytics Queries (To Build)
- Monthly active users (travelers vs. guides)
- Booking volume & trends
- Average booking value
- Guide earnings by month
- Review sentiment analysis
- Cancellation rates
- Customer acquisition cost (CAC)
- User retention rates

## Data Validation Rules
- Email format validation
- Phone number format (India: +91 format)
- Price validation (no negative values)
- Review rating (1-5 scale)
- Booking date must be in future
- Payment status consistency

## Backup & Recovery
- Document backup schedules
- Test recovery procedures regularly
- Store backups in secure, separate location
- Document recovery time objectives (RTO)

## Tools Recommended
- **Database Design**: DbDiagram.io, Lucidchart, draw.io
- **Query Tools**: DBeaver, pgAdmin (for PostgreSQL)
- **Migration Tools**: Flyway, Liquibase, or native scripting
- **Analytics**: SQL queries, Metabase, Tableau
- **Backup**: Supabase automated backups, AWS S3, or custom scripts

## Data Privacy & Security
- [ ] PII handling policy documented
- [ ] Access control rules defined
- [ ] Data encryption at rest & in transit
- [ ] GDPR compliance for EU users
- [ ] India privacy law compliance
- [ ] Data retention policies
- [ ] Regular security audits

## Migration Strategy
1. Version all migrations (001, 002, etc.)
2. Include both UP (forward) and DOWN (rollback) scripts
3. Test migrations in staging before production
4. Document any manual data transformation needs
5. Keep migration history for reference

## Development Workflow
1. Schema changes → Write migration file
2. Test migration locally
3. Update seed data if needed
4. Commit migration to version control
5. Deploy to staging → Test thoroughly
6. Deploy to production with backup

## Key Metrics to Track
- Database size & growth
- Query performance (slow queries)
- Backup success rate
- Data consistency checks
- Storage usage trends
- Number of active vs. inactive accounts
