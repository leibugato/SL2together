class AppError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryable = retryable;
  }
}

module.exports = {
  AppError,
};

