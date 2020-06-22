module.exports = {
  ErrorResult(errorCode, errorMsg, data) {
    return {
      success: false,
      errorCode,
      msg: errorMsg,
      data
    }
  },
  SuccessResult(data) {
    return {
      success: true,
      errorCode: 0,
      msg: 'success',
      data
    }
  }
}
