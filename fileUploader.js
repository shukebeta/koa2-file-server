const path = require('path')
const multer = require('koa-multer')
const shell = require('shelljs')
const md5File = require('md5-file')
const {SuccessResult, ErrorResult} = require('./ApiResult')
/**
 * @description simple file upload
 * @param {Object} config - 上传配置项
 * @param {String} config.destPath - '/dir' - 一个绝对路径
 * @param {String} [config.apiPath=/api/upload] - api路径
 * @param {String[]} [config.allowedExt] - 允许的文件类型列表
 * @param {Number} [config.allowedSize=1024*20] - 允许的文件大小,单位KB
 * @param {String} [config.fileFieldName="file"] - post字段,默认为file
 */
module.exports = (config = {}) => {
  const getHashDir = () => {
    let getRandInt = () => {
      return Math.floor(Math.random() * 10)
    }
    return `/${getRandInt()}${getRandInt()}/${getRandInt()}${getRandInt()}/`
  }

  const storage = multer.diskStorage({
    destination(req, file, callback) {
      const savePath = config.destPath + getHashDir()
      const stderr = shell.mkdir('-p', savePath).stderr
      if (stderr === null) {
        callback(null, savePath)
      } else {
        throw new Error(stderr)
      }
    },
    filename(req, file, cb) {
      cb(null, file.originalname)
    }
  })

  const fileFilter = (req, file, cb) => {
    let extName = path.extname(file.originalname).toLowerCase()
    if (config.allowedExt && config.allowedExt.length && config.allowedExt.indexOf(extName) < 0) {
      cb({
        code: 'FILE_TYPE_ERROR',
        message: `only ${config.allowedExt.join(',')} files are allowed to upload.`
      }, false)
    } else {
      cb(null, true)
    }
  }
  const doUpload = async (ctx, next) => {
    try {
      await ctx.upload.array(config.fileFieldName)(ctx, next)
      const files = ctx.req.files
      if (!files) {
        return await next()
      }
      let data = []
      for(let file of files) {
        let newPathFile, filePath
        const md5 = md5File.sync(file.path)
        let fileExt = path.extname(file.filename)
        // update file.filename to new name
        file.filename = `${md5}${fileExt}`
        const oldFile = await ctx.db.yangtaoFiles.findOne({
          where: {
            md5
          }
        })
        if (oldFile) {
          filePath = oldFile.path
          fileExt = oldFile.FileExt
          shell.rm(file.path)
          await ctx.db.yangtaoFiles.update({
            refCount: ctx.db.sequelize.literal('`RefCount` + 1')
          }, {
            where: {
              id: oldFile.id
            }
          })
        } else {
          filePath = file.destination.replace(config.destPath, '')
          newPathFile = path.join(file.destination, file.filename)
          const stderr = shell.mv(file.path, newPathFile).stderr
          if (stderr !== null) {
            throw new Error({
              code: 'MOVING FILE ERROR',
              message: stderr
            })
          }
          const currentTime = new Date(new Date().toUTCString())
          const newFile = await ctx.db.yangtaoFiles.create({
            id: 0,
            path: filePath,
            md5: md5,
            fileExt: fileExt,
            refCount: 1,
            createAt: currentTime,
            updateAt: currentTime
          })
          console.log(newFile)
        }

        data.push({
          fileName: file.filename,
          filePath,
          originalFileName: file.originalname
        })
      }
      ctx.body = SuccessResult(data)
      return false
    } catch (e) {
      switch (e.code) {
        case 'FILE_TYPE_ERROR': {
          ctx.body = ErrorResult(9111, e.message)
          break
        }
        case 'MOVING_FILE_ERROR': {
          ctx.body = ErrorResult(9112, `Cannot move file to ${file.destination}`)
          break
        }
        case 'LIMIT_FILE_SIZE': {
          ctx.body = ErrorResult(9113, `File is larger than ${config.allowedSize}KB`)
          break
        }
        case 'LIMIT_UNEXPECTED_FILE':
          ctx.body = ErrorResult(9114, `Unexpected fileFieldName: ${config.fileFieldName}`)
          break
        default:
          console.log(e)
          ctx.body = ErrorResult(9115, `${e.name}: ${e.toString()}`)
      }
    }
  }
  return async (ctx, next) => {
    if (ctx.method !== 'POST') {
      await next()
      return false
    }

    const mConfig = {
      fileFilter,
      storage,
      limits: {
        fileSize: config.allowedSize * 1024
      }
    }

    ctx.upload = multer(mConfig)
    if (config.apiPath) {
        if (ctx.path === config.apiPath) {
          await doUpload(ctx, next)
        } else {
          await next()
          return false
        }
    } else {
      await doUpload(ctx, next)
    }
  }
}

