# GitHub Workflows & CI/CD

## Purpose
Store GitHub Actions workflows for continuous integration and continuous deployment. This folder automates testing, linting, building, and deploying code to ensure code quality and reduce manual deployment steps.

## Contents
- Automated testing workflows (unit, integration tests)
- Code linting & formatting checks
- Build verification workflows
- Deployment workflows (staging, production)
- Release & versioning workflows
- Security scanning workflows
- Performance & monitoring workflows

## Folder Organization
```
.github/
├── workflows/
│   ├── ci.yml              # Continuous Integration (tests, lint)
│   ├── build.yml           # Build verification
│   ├── deploy-staging.yml  # Deploy to staging environment
│   ├── deploy-prod.yml     # Deploy to production (manual approval)
│   ├── security-scan.yml   # Security vulnerability scanning
│   ├── release.yml         # Automated versioning & releases
│   └── performance.yml     # Performance testing & reporting
│
├── scripts/
│   └── deploy.sh           # Deployment helper scripts
│
└── WORKFLOWS.md            # Documentation
```

## Core Workflows to Implement

### 1. Continuous Integration (ci.yml)
Runs on every push and pull request:
- Install dependencies
- Run linting (ESLint, Prettier)
- Run unit tests
- Generate coverage reports
- Check for code quality issues

### 2. Build Verification (build.yml)
Verifies that code builds successfully:
- Build website (Vite)
- Build web app (Next.js)
- Build mobile app (Expo)
- Check for build errors
- Generate artifacts

### 3. Deployment Workflows
Deploy code to different environments:
- **Staging**: Auto-deploy on merge to develop branch
- **Production**: Manual approval required
- Includes pre-deployment checks, backups, health checks

### 4. Security Scanning (security-scan.yml)
Automated security checks:
- Dependency vulnerability scanning (npm audit)
- Code security analysis (SonarQube, CodeQL)
- Secret detection (Truffles, GitGuardian)
- OWASP checks

## Example Workflow Files

### ci.yml - Continuous Integration
```yaml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### deploy-staging.yml
```yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel (Staging)
        uses: vercel/actions/deploy-production@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

### deploy-prod.yml
```yaml
name: Deploy to Production

on:
  workflow_dispatch:  # Manual trigger only

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Pre-deployment checks
        run: ./scripts/pre-deploy-checks.sh
      
      - name: Backup database
        run: ./scripts/database/backup-database.sh
      
      - name: Deploy
        run: ./scripts/deployment/deploy-production.sh
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## GitHub Secrets (To Configure)
Store sensitive data in GitHub repository settings:
- `VERCEL_TOKEN` - Deployment authorization
- `SUPABASE_TOKEN` - Database access
- `RAZORPAY_KEY_SECRET` - Payment gateway credentials
- `DEPLOY_KEY` - Server SSH key
- `SLACK_WEBHOOK` - Notification URL
- `DATABASE_URL` - Production database URL

**Never commit secrets to version control!**

## Branch Strategy
```
main                  # Production-ready code (protected)
├── develop           # Integration branch for features
│   ├── feature/...   # Feature branches
│   └── bugfix/...    # Bug fix branches
```

Workflow:
1. Create feature branch from `develop`
2. Push and create Pull Request
3. CI/CD runs automatically
4. Code review & approval
5. Merge to `develop` → auto-deploy to staging
6. Merge to `main` → manual trigger for production deployment

## GitHub Actions Marketplace
Useful pre-built actions:
- `actions/checkout` - Clone repository
- `actions/setup-node` - Install Node.js
- `actions/setup-python` - Install Python
- `codecov/codecov-action` - Upload coverage reports
- `vercel/actions/deploy-production` - Deploy to Vercel
- `aws-actions/configure-aws-credentials` - AWS authentication
- `aquasecurity/trivy-action` - Security scanning
- `SonarSource/sonarcloud-github-action` - Code quality

## Setting Up GitHub Actions

1. **Create workflow files** in `.github/workflows/`
2. **Push to repository** - GitHub automatically detects workflows
3. **Configure secrets** in repository settings
4. **Enable branch protection** - Require CI to pass before merging
5. **Monitor workflow runs** in "Actions" tab

## Monitoring & Alerts
- View all workflow runs in GitHub Actions dashboard
- Set up Slack notifications for deployment status
- Email notifications for failed builds
- Status badges in README
- Deployment tracking dashboard

## Best Practices
- Keep workflows DRY (reusable steps)
- Use caching to speed up builds
- Limit concurrent workflows (cost control)
- Regular cleanup of old artifacts
- Document each workflow's purpose
- Test workflows in development first
- Use environments for deploy approvals
- Monitor action execution time & costs

## Tools for Local Testing
Test GitHub Actions locally before pushing:
```bash
# Install act tool
brew install act

# Run workflows locally
act -j test
act -j deploy-staging
```

## Continuous Deployment Strategy
- **Website**: Deploy on every push to main
- **Web App**: Deploy on main (production), develop (staging)
- **Mobile**: Auto-build on main, submit to app stores manually
- **Backend**: Deploy on main with approval

## Performance Monitoring
- Track action execution time
- Identify bottlenecks
- Optimize build & test processes
- Monitor GitHub Actions costs

## Documentation
Maintain updated documentation:
- Workflow purpose and triggers
- Environment variables required
- Secrets needed
- Expected duration
- On-call contacts for failures
- Rollback procedures
