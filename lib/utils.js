const fs = require('fs/promises')

const removeFile = async (filePath) => {
  try {
    await fs.unlink(filePath)
  } catch (err) {
    throw new Error(`Failed to remove file at ${filePath}: ${err.message}`)
  }
}

const removeDir = async (dirPath) => {
  try {
    await fs.rmdir(dirPath, { recursive: true })
  } catch (err) {
    throw new Error(`Failed to remove directory at ${dirPath}: ${err.message}`)
  }
}
module.exports = {removeFile, removeDir}
