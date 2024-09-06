const path = require('path')
const multer = require('koa-multer')
const shell = require('shelljs')
const md5File = require('md5-file')
const {SuccessResult, ErrorResult} = require('./ApiResult')
const {removeFile, removeDir} = require('./lib/utils')
/**
 * @description simple file upload
 * @param {Object} config - 上传配置项
 * @param {String} config.destPath - '/dir' - 一个绝对路径
 * @param {String} [config.apiUri=/api/upload] - 单个文件上传时使用的api路径
 * @param {String} [config.apiUriMulti=/api/uploadMulti] - 一次上传多个文件时使用的api路径
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

  const cleanUploadDir = async (file) => {
    console.log(file)
    // remove file
    // await removeFile(file.path)
    // second level hash
    await removeDir(file.destination)
    // first level hash
    await removeDir(file.destination.replace(/\d+\/$/, ''))
  }

  const storage = multer.diskStorage({
    destination(req, file, callback) {
      const savePath = '/tmp/uploadedFiles' + getHashDir()
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
    let extName = path.extname(file.originalname).toLowerCase().trim();
    if (config.allowedExt && config.allowedExt.length && config.allowedExt.indexOf(extName) < 0) {
      cb({
        code: 'FILE_TYPE_ERROR',
        message: `only ${config.allowedExt.join(',')} files are allowed to upload.`
      }, false)
    } else {
      cb(null, true)
    }
  }
  const doUpload = async (ctx, next, mInstance) => {
    console.log(ctx)
    try {
      let single = true
      let files
      if (ctx.path === config.apiUri) {
        await mInstance.single(config.fileFieldName)(ctx, next)
        files = [ctx.req.file]
      } else {
        await mInstance.array(config.fileFieldName)(ctx, next)
        files = ctx.req.files
        single = false
      }

      let data = []
      /*
      file fields definition:
      {
        fieldname: 'img',
        originalname: 'WWW.YTS.RE.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        destination: '/tmp/uploadedFiles/97/17/',
        filename: 'WWW.YTS.RE.jpg',
        path: '/tmp/uploadedFiles/97/17/WWW.YTS.RE.jpg',
        size: 208047
      }
      */
      for(let file of files) {
        let filePath, fileName
        if (file === undefined) continue
        const md5 = md5File.sync(file.path)
        let fileExt = path.extname(file.filename)
        const oldFile = await ctx.db.files.findOne({
          where: {
            md5
          }
        })
        if (oldFile) {
          filePath = oldFile.path
          fileExt = oldFile.fileExt
          fileName = `${md5}${fileExt}`
          await cleanUploadDir(file)
          await ctx.db.files.update({
            refCount: ctx.db.sequelize.literal('`RefCount` + 1'),
            fileName: file.originalname
          }, {
            where: {
              id: oldFile.id
            }
          })
        } else {
          filePath = getHashDir()
          fileName = `${md5}${fileExt}`
          const newPath = path.join(config.destPath, filePath)
          let stderr = shell.mkdir('-p', newPath).stderr
          if (stderr !== null) {
            throw new Error(stderr)
          }
          stderr = shell.mv(file.path, path.join(newPath, fileName)).stderr
          if (stderr !== null) {
            throw new Error(stderr)
          }
          cleanUploadDir(file)
          const currentTime = Math.round(+new Date()/1000)
          await ctx.db.files.create({
            id: 0,
            path: filePath,
            md5: md5,
            fileExt: fileExt,
            refCount: 1,
            fileName: file.originalname,
            createAt: currentTime,
            updateAt: currentTime
          })
        }

        data.push({
          fileName,
          filePath,
          originalFileName: file.originalname,
          url: `${process.env.IMG_SERVER}/320${filePath}${fileName}`
        })
      }
      if (data.length < 1) {
        ctx.body = ErrorResult(1001, 'None of your files are uploaded.')
      }
      ctx.body = SuccessResult(single ? data[0] : data)
      return false
    } catch (e) {
      switch (e.code) {
        case 'FILE_TYPE_ERROR': {
          ctx.body = ErrorResult(9111, e.message)
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
      return false
    }
    await doUpload(ctx, next, mInstance)
  }
}

