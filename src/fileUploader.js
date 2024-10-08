const path = require('path')
const multer = require('koa-multer')
const md5File = require('md5-file')
const { SuccessResult, ErrorResult } = require('./ApiResult')
const { createDirectory, moveFile, removeFile, removeDir } = require('./lib/utils'); // Import utility methods

module.exports = (config = {}) => {
  const getHashDir = () => {
    const getRandInt = () => Math.floor(Math.random() * 10)
    return `/${getRandInt()}${getRandInt()}/${getRandInt()}${getRandInt()}/`
  }

  const cleanUploadDir = async (file) => {
    try {
      await removeDir(file.destination)
      await removeDir(file.destination.replace(/\d+\/$/, ''))
    } catch (error) {
      throw new Error(`Failed to clean upload directory: ${error.message}`)
    }
  }

  const storage = multer.diskStorage({
    destination: async (req, file, callback) => {
      const savePath = config.destPath + '/tmp/uploadedFiles' + getHashDir()
      try {
        await createDirectory(savePath)
        callback(null, savePath)
      } catch (error) {
        callback(error)
      }
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname)
    }
  })

  const fileFilter = (req, file, cb) => {
    const extName = path.extname(file.originalname).toLowerCase().trim()
    if (config.allowedExt && config.allowedExt.length && !config.allowedExt.includes(extName)) {
      cb({
        code: 'FILE_TYPE_ERROR',
        message: `Only ${config.allowedExt.join(',')} files are allowed to upload.`
      }, false)
    } else {
      cb(null, true)
    }
  }

  const doUpload = async (ctx, next, mInstance) => {
    try {
      const isSingle = ctx.path === config.apiUri
      await mInstance[isSingle ? 'single' : 'array'](config.fileFieldName)(ctx, next)
      const files = isSingle ? [ctx.req.file] : ctx.req.files

      let data = []
      for (const file of files) {
        if (!file) continue
        const md5 = md5File.sync(file.path)
        let fileExt = path.extname(file.filename)
        let image = await ctx.db.files.findOne({ where: { md5 } })
        const nowInUnixTimestamp = Math.round(Date.now() / 1000)

        if (image) {
          await cleanUploadDir(file)
          await ctx.db.files.update({
            refCount: ctx.db.sequelize.literal('`RefCount` + 1'),
            updatedAt: nowInUnixTimestamp,
            fileName: file.originalname
          }, { where: { id: image.id } })
          image.refCount += 1
          image.updatedAt = nowInUnixTimestamp
        } else {
          const filePath = getHashDir()
          const fileName = `${md5}${fileExt}`
          const newPath = path.join(config.destPath, filePath)

          await createDirectory(newPath)
          await moveFile(file.path, path.join(newPath, fileName))
          await cleanUploadDir(file)

          image = await ctx.db.files.create({
            id: 0,
            path: filePath,
            md5,
            fileExt,
            refCount: 1,
            fileName: file.originalname,
            createdAt: nowInUnixTimestamp,
            updatedAt: null
          })
        }
        image = image.toJSON()
        image.url = `${config.imgServer}/320${image.path}${image.md5}${image.fileExt}`
        data.push(image)
      }

      ctx.body = data.length ? SuccessResult(isSingle ? data[0] : data) : ErrorResult(1001, 'None of your files were uploaded.')
    } catch (e) {
      console.log(e)
      ctx.status = 503;
      switch (e.code) {
        case 'FILE_TYPE_ERROR':
          ctx.body = ErrorResult(9111, e.message)
          break
        case 'LIMIT_FILE_SIZE':
          ctx.body = ErrorResult(9113, `File is larger than ${config.allowedSize}KB`)
          break
        case 'LIMIT_UNEXPECTED_FILE':
          ctx.body = ErrorResult(9114, `Unexpected fileFieldName: ${config.fileFieldName}`)
          break
        default:
          ctx.body = ErrorResult(9115, e.message)
      }
    }
  }

  const mConfig = {
    fileFilter,
    storage,
    limits: {
      fileSize: config.allowedSize * 1024
    }
  }
  const mInstance = multer(mConfig)

  return async (ctx, next) => {
    if (ctx.method !== 'POST' || !(ctx.path === config.apiUri || ctx.path === config.apiUriMulti)) {
      await next()
      return
    }
    await doUpload(ctx, next, mInstance)
  }
}
