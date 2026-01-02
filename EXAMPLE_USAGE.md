# Example: Using Munchi SDK in Your Project

This example shows how to set up and use the Munchi SDK in your project with NODE_AUTH_TOKEN authentication.

## Project Setup

### 1. Create Your Project

```bash
mkdir my-munchi-app
cd my-munchi-app
npm init -y
```

### 2. Set Up Authentication

**Option A: Environment Variable (Recommended)**

Add to your `~/.zshrc` or `~/.bashrc`:
```bash
export NODE_AUTH_TOKEN=ghp_your_github_token_here
```

Then reload:
```bash
source ~/.zshrc
```

**Option B: Project .npmrc (Not Recommended - Security Risk)**

Create `.npmrc` in your project root:
```
@munchi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

**⚠️ IMPORTANT:** Add `.npmrc` to `.gitignore`!

### 3. Install Munchi SDK

```bash
npm install @munchi/core @munchi/payments
```

### 4. Create Your Application

**package.json:**
```json
{
  "name": "my-munchi-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "@munchi/core": "^1.0.0",
    "@munchi/payments": "^1.0.0",
    "axios": "^1.6.0"
  }
}
```

**index.js:**
```javascript
import { MUNCHI_CORE_VERSION } from '@munchi/core';

console.log('🚀 Munchi SDK Example App');
console.log('Using @munchi/core version:', MUNCHI_CORE_VERSION);

// Your application logic here
```

**TypeScript Example (index.ts):**
```typescript
import { MUNCHI_CORE_VERSION } from '@munchi/core';

console.log('🚀 Munchi SDK Example App');
console.log('Using @munchi/core version:', MUNCHI_CORE_VERSION);

// Your application logic here with full type safety
```

### 5. Run Your Application

```bash
npm start
```

## Complete Example with TypeScript

### Setup TypeScript Project

```bash
# Install TypeScript dependencies
npm install -D typescript @types/node tsx

# Initialize TypeScript config
npx tsc --init
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### package.json (TypeScript)
```json
{
  "name": "my-munchi-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@munchi/core": "^1.0.0",
    "@munchi/payments": "^1.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### src/index.ts
```typescript
import { MUNCHI_CORE_VERSION } from '@munchi/core';

interface AppConfig {
  version: string;
  environment: string;
}

class MunchiApp {
  private config: AppConfig;

  constructor() {
    this.config = {
      version: MUNCHI_CORE_VERSION,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  start(): void {
    console.log('🚀 Munchi SDK Example App');
    console.log('Version:', this.config.version);
    console.log('Environment:', this.config.environment);
    
    // Your application logic here
  }
}

const app = new MunchiApp();
app.start();
```

## CI/CD Example

### GitHub Actions

**.github/workflows/ci.yml:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build
        run: npm run build
      
      - name: Test
        run: npm test
```

### GitLab CI

**.gitlab-ci.yml:**
```yaml
image: node:18

stages:
  - build
  - test

before_script:
  - export NODE_AUTH_TOKEN=$GITHUB_TOKEN
  - npm install

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/

test:
  stage: test
  script:
    - npm test
```

**Note:** Add `GITHUB_TOKEN` as a CI/CD variable in GitLab settings.

## Docker Example

### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Set NODE_AUTH_TOKEN for npm install
ARG NODE_AUTH_TOKEN
ENV NODE_AUTH_TOKEN=$NODE_AUTH_TOKEN

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build if using TypeScript
RUN npm run build

# Start application
CMD ["npm", "start"]
```

### Build and Run
```bash
# Build with auth token
docker build \
  --build-arg NODE_AUTH_TOKEN=$NODE_AUTH_TOKEN \
  -t my-munchi-app .

# Run
docker run my-munchi-app
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      args:
        NODE_AUTH_TOKEN: ${NODE_AUTH_TOKEN}
    environment:
      - NODE_ENV=production
    ports:
      - "3000:3000"
```

## Environment Variables

### .env.example
```bash
# GitHub Authentication
NODE_AUTH_TOKEN=ghp_your_token_here

# Application Config
NODE_ENV=development
PORT=3000
```

### .gitignore
```gitignore
# Dependencies
node_modules/

# Build output
dist/

# Environment files
.env
.env.local
.npmrc

# OS files
.DS_Store

# IDE
.vscode/
.idea/
```

## Best Practices

### 1. Security
```bash
# ✅ DO: Use environment variables
export NODE_AUTH_TOKEN=ghp_xxx

# ❌ DON'T: Hardcode in files
const token = 'ghp_xxx'; // Never do this!
```

### 2. Version Pinning
```json
{
  "dependencies": {
    "@munchi/core": "1.0.0",  // Exact version
    "@munchi/payments": "^1.0.0"  // Compatible version
  }
}
```

### 3. Error Handling
```typescript
import { MUNCHI_CORE_VERSION } from '@munchi/core';

try {
  console.log('SDK Version:', MUNCHI_CORE_VERSION);
  // Your logic here
} catch (error) {
  console.error('Error using Munchi SDK:', error);
  process.exit(1);
}
```

## Troubleshooting

### "Unable to authenticate"
```bash
# Check if token is set
echo $NODE_AUTH_TOKEN

# If not set, add to shell profile
echo 'export NODE_AUTH_TOKEN=ghp_xxx' >> ~/.zshrc
source ~/.zshrc
```

### "Module not found"
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Permission denied"
```bash
# Check GitHub token scopes
# Token needs: read:packages

# Verify repository access
npm view @munchi/core
```

## Next Steps

1. ✅ Set up `NODE_AUTH_TOKEN`
2. ✅ Install Munchi SDK
3. ✅ Create your application
4. ✅ Add to version control (don't commit tokens!)
5. ✅ Set up CI/CD
6. ✅ Deploy

## Resources

- [AUTH_SETUP.md](./AUTH_SETUP.md) - Authentication guide
- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide
- [README.md](./README.md) - Full documentation

---

**Happy coding! 🚀**
