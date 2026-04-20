import { execSync } from 'node:child_process'
import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import * as dotenv from 'dotenv'

const bump = process.argv[2] ?? 'patch'

const envPath = path.resolve('.', '.env')
const envLocalPath = path.resolve('.', '.env.local')

const hasEnv = fs.existsSync(envPath)
const hasEnvLocal = fs.existsSync(envLocalPath)

// 1. Fail fast if absolutely nothing is available
if (!hasEnv && !hasEnvLocal) {
  throw new Error('No environment files found. Please create .env or .env.local.')
}

// 2. Load base environment (polite, sets defaults)
if (hasEnv) {
  dotenv.config({ path: envPath })
}

// 3. Load local environment (ruthless, overwrites base)
if (hasEnvLocal) {
  dotenv.config({ path: envLocalPath, override: true })
}

// Execute pipeline
execSync('npm run build', { stdio: 'inherit', env: process.env })
execSync(`npm version ${bump}`, { stdio: 'inherit', env: process.env })
execSync('npm publish', { stdio: 'inherit', env: process.env })
