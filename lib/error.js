/**
 * Alternative Error implementation, allowing for status codes.
 */
module.exports = class Error2 extends Error {
  /**
   * @param {String} message error message
   * @param {Number=} code error code
   * @param {Error=} error an error this is wrapping
   */
  constructor(message, code, error) {
    super(message)
    this.enclosedError = error;
    this.code = code
    this.userFacing = true
  }
}