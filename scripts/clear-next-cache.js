const fs = require('fs')
const path = require('path')

const nextDir = path.join(process.cwd(), '.next')

try {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true })
    console.log('Cleared .next cache')
  } else {
    console.log('No .next cache to clear')
  }
} catch (error) {
  console.warn('Could not clear .next cache:', error?.message || error)
}
