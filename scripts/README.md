# Scripts & Automation

## Purpose
Store utility scripts, automation tools, and helper scripts for development, deployment, and operational tasks. This folder helps automate repetitive tasks and improve development workflow.

## Contents
- Database setup & initialization scripts
- Data migration scripts
- Deployment automation scripts
- Testing automation scripts
- Development environment setup
- Batch data processing scripts
- Monitoring & health check scripts
- Backup & maintenance scripts

## Script Organization
```
scripts/
├── setup/
│   ├── setup-dev-env.sh      # Configure local development environment
│   ├── install-dependencies.sh
│   └── init-database.sh       # Initialize PostgreSQL with schema
│
├── deployment/
│   ├── deploy-staging.sh      # Deploy to staging environment
│   ├── deploy-production.sh   # Deploy to production
│   ├── pre-deploy-checks.sh   # Sanity checks before deployment
│   └── rollback.sh            # Rollback to previous version
│
├── database/
│   ├── backup-database.sh     # Backup PostgreSQL
│   ├── restore-database.sh    # Restore from backup
│   ├── migrate.sh             # Run database migrations
│   ├── seed-data.sh           # Populate test data
│   └── reset-dev-db.sh        # Reset database to clean state
│
├── testing/
│   ├── run-tests.sh           # Run all tests
│   ├── run-unit-tests.sh      # Unit tests only
│   ├── run-integration-tests.sh
│   ├── lint-code.sh           # Code linting & formatting
│   └── security-scan.sh       # Security vulnerability scan
│
├── monitoring/
│   ├── health-check.sh        # Check system health
│   ├── log-analyzer.sh        # Parse and analyze logs
│   ├── performance-report.sh  # Generate performance metrics
│   └── alert-setup.sh         # Configure monitoring alerts
│
├── maintenance/
│   ├── cleanup-logs.sh        # Archive old logs
│   ├── optimize-database.sh   # Database optimization (vacuum, reindex)
│   ├── cache-clear.sh         # Clear caches
│   └── update-dependencies.sh # Update npm/pip packages
│
├── utilities/
│   ├── generate-sample-data.js # Create test data programmatically
│   ├── csv-importer.js         # Import CSV files to database
│   ├── email-sender.js         # Batch email sending
│   └── batch-processor.js      # Process large data batches
│
└── README-SCRIPTS.md           # Detailed documentation
```

## Essential Scripts to Create

### Development Setup
```bash
# setup-dev-env.sh
#!/bin/bash
echo "Setting up Mumbai Buddies development environment..."
npm install
npm install -g @supabase/cli
supabase start
npm run dev
```

### Database Initialization
```bash
# init-database.sh
#!/bin/bash
psql -U postgres -d mumbai_buddies < data/schemas/initial_schema.sql
psql -U postgres -d mumbai_buddies < data/seed-data/test-users.sql
psql -U postgres -d mumbai_buddies < data/seed-data/test-guides.sql
echo "Database initialized with test data"
```

### Pre-Deployment Checks
```bash
# pre-deploy-checks.sh
#!/bin/bash
echo "Running pre-deployment checks..."
npm run lint
npm run test
npm run build
echo "All checks passed! Ready for deployment"
```

## Script Usage Guidelines
- All scripts should have clear documentation at the top
- Include error handling and exit codes
- Add progress indicators for long-running scripts
- Log output to file for debugging
- Use environment variables for configuration
- Make scripts idempotent (safe to run multiple times)
- Test scripts locally before committing

## Environment-Specific Scripts
Create separate scripts for different environments:
- **Development** (local machine)
- **Staging** (staging server for testing)
- **Production** (live environment)

Example:
```bash
#!/bin/bash
ENVIRONMENT=${1:-development}

if [ "$ENVIRONMENT" = "production" ]; then
  # Production-specific logic
  echo "Deploying to PRODUCTION..."
else
  # Development/staging logic
  echo "Deploying to $ENVIRONMENT..."
fi
```

## Scheduling Automation (Cron Jobs)
Document scheduled tasks:
- Nightly backups: `0 2 * * * /scripts/database/backup-database.sh`
- Weekly optimization: `0 3 * * 0 /scripts/maintenance/optimize-database.sh`
- Daily health checks: `*/30 * * * * /scripts/monitoring/health-check.sh`

## CI/CD Integration
Scripts should integrate with GitHub Actions:
- Run linting on PR
- Run tests on every push
- Auto-deploy to staging on merge to develop
- Manual approval for production deployment

## Tools for Script Execution
- **Bash**: Linux/Mac shell scripting
- **Node.js**: JavaScript-based automation
- **Python**: Data processing & utilities
- **Make**: Task automation (Makefile)

## Example Makefile (Optional)
```makefile
.PHONY: help setup dev test deploy

help:
	@echo "Available commands:"
	@echo "  make setup     - Set up development environment"
	@echo "  make dev       - Start development server"
	@echo "  make test      - Run tests"
	@echo "  make deploy    - Deploy to production"

setup:
	./scripts/setup/setup-dev-env.sh

dev:
	npm run dev

test:
	./scripts/testing/run-tests.sh

deploy:
	./scripts/deployment/deploy-production.sh
```

## Documentation for Each Script
- **Purpose**: What does the script do?
- **Prerequisites**: What must be set up before running?
- **Usage**: How to execute the script
- **Parameters**: Command-line arguments (if any)
- **Output**: What the script produces
- **Side Effects**: What changes does it make?
- **Error Handling**: How to handle failures
- **Example**: Real usage example

## Safety Practices
- Always ask for confirmation before destructive operations
- Create backups before major changes
- Use dry-run mode to preview changes
- Log all operations for audit trail
- Limit script permissions (chmod 755)
- Secure sensitive data (API keys, passwords) in .env files

## Performance Optimization
- Use parallel execution for independent tasks
- Add progress bars for long operations
- Cache data when appropriate
- Avoid unnecessary database queries
- Profile script execution time

## Testing Scripts
- Test scripts in development environment first
- Create unit tests for critical functions
- Document expected behavior
- Test edge cases and error conditions
- Version control all scripts
