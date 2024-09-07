const fs = require('fs/promises')

// Create a directory (like `mkdir -p`)
async function createDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    console.log(`Directory created: ${dirPath}`)
  } catch (error) {
    console.error(`Failed to create directory: ${dirPath}`, error)
    throw error
  }
}

// Move a file from source to destination
async function moveFile(srcPath, destPath) {
  try {
    await fs.rename(srcPath, destPath)
    console.log(`File moved from ${srcPath} to ${destPath}`)
  } catch (error) {
    console.error(`Failed to move file from ${srcPath} to ${destPath}`, error)
    throw error
  }
}

// Remove a file
async function removeFile(filePath) {
  try {
    await fs.unlink(filePath)
    console.log(`File removed: ${filePath}`)
  } catch (error) {
    console.error(`Failed to remove file: ${filePath}`, error)
    throw error
  }
}

// Remove a directory (like `rmdir`)
async function removeDir(dirPath) {
  try {
    await fs.rmdir(dirPath, { recursive: true })
    console.log(`Directory removed: ${dirPath}`)
  } catch (error) {
    console.error(`Failed to remove directory: ${dirPath}`, error)
    throw error
  }
}

module.exports = {
  createDirectory,
  moveFile,
  removeFile,
  removeDir,
}
