import { execSync } from 'node:child_process'
import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const bump = process.argv[2] ?? 'patch'

const envLocalPath = path.resolve('.', './.env.local')
const envPath = path.resolve('.', './.env')

const isEnvLocalExisting = fs.existsSync(envLocalPath)
const isEnvExisting = fs.existsSync(envPath)

if (isEnvLocalExisting) {
  dotenv.config({ path: envLocalPath })
} else if (isEnvExisting) {
  dotenv.config({ path: envPath })
} else {
  throw new Error('No env file found. Pls create one.')
}

execSync('npm run build', { stdio: 'inherit', env: process.env })
execSync(`npm version ${bump}`, { stdio: 'inherit', env: process.env })
execSync('npm publish', { stdio: 'inherit', env: process.env })
