# Detour - Project Overview

## Project Name
**Detour**

## One-Line Description
A platform connecting international travelers with knowledgeable student guides in Mumbai, enabling authentic local experiences and earning opportunities for students.

---

## Folder Structure

```
mumbai-buddies/
├── website/                    # Marketing website (Vite + Tailwind)
├── webapp/                     # Web application (Next.js) - Future
├── mobile/                     # Mobile apps (React Native/Expo) - Future
├── backend/                    # API & backend services - Future
├── docs/                       # Documentation & research
│   ├── research/
│   ├── legal/
│   ├── business/
│   └── technical/
├── design/                     # Design assets
│   ├── brand/
│   ├── ui-mockups/
│   └── marketing/
├── data/                       # Database schemas, seed data, analytics
├── scripts/                    # Utility scripts, automation
└── .github/                    # GitHub workflows & CI/CD
```

---

## Tech Stack Overview

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Website** | Vite + Tailwind CSS | Marketing & landing pages |
| **Web App** | Next.js | Full-stack web application |
| **Mobile** | React Native / Expo | iOS & Android applications |
| **Backend** | Supabase or Node.js | APIs & server logic |
| **Database** | PostgreSQL | Primary data storage |
| **Payments** | Razorpay | Payment processing |
| **Hosting** | TBD | Deployment infrastructure |

---

## Quick Start - Existing Website

### Prerequisites
- Node.js 16+ and npm

### Installation & Development
```bash
cd mumbai-buddies
npm install
npm run dev
```

The marketing website will be available at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Current Website Files
- `index.html` - Home page
- `know-more.html` - About/More info page
- `src/` - Source files (CSS, JS)
- `public/` - Static assets
- `dist/` - Built production files (generated)

---

## Tech Stack Details

### Frontend Technologies
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Next.js**: React framework for web app (future)
- **React Native / Expo**: Cross-platform mobile development

### Backend & Infrastructure
- **Supabase**: PostgreSQL database with built-in Auth & APIs
- **Alternative**: Node.js + Express for custom backend
- **PostgreSQL**: Relational database for user, guide, booking data

### Other Services
- **Razorpay**: Payment gateway for INR transactions
- **GitHub Actions**: CI/CD automation (future)
- **Figma**: Design collaboration tool

---

## Team & Contact

| Role | Name | Contact |
|------|------|---------|
| Founder/Project Lead | Gaurav | [gaurav@detourtrips.com] |
| | | |

*To be updated as team grows*

---

## Project Status

- ✅ Marketing website (Vite + Tailwind)
- 🔲 Web application (Next.js) - In Planning
- 🔲 Mobile apps (React Native/Expo) - In Planning
- 🔲 Backend API (Supabase/Node.js) - In Planning
- 🔲 Database design & migration - Planned
- 🔲 Payment integration - Planned
- 🔲 CI/CD pipelines - Planned

---

## Getting Started
1. Review the README files in each folder for detailed setup instructions
2. Start with the existing **website** folder for the marketing site
3. Plan the **webapp** structure using Next.js best practices
4. Design the **mobile** app flow using Expo for quick iteration
5. Set up **backend** APIs in Supabase or Node.js
6. Document everything in **docs/** as you progress

---

## Additional Resources
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [Next.js Documentation](https://nextjs.org/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Razorpay Integration Guide](https://razorpay.com/docs/)

---

*Last Updated: 2026-04-11*
