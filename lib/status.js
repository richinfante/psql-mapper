/**
 * The request was handled successfully
 */
module.exports.OK = 200

/**
 * The server cannot or will not process the request due to something that is perceived to be a client error.
 */
module.exports.BAD_REQUEST = 400

/**
 * The request has not been applied because it lacks valid authentication credentials for the target resource.
 */
module.exports.NOT_AUTHORIZED = 401

/**
 * The server understood the request but refuses to authorize it.
 */
module.exports.FORBIDDEN = 403

/**
 * The origin server did not find a current representation for the target resource or is not willing to disclose that one exists.
 */
module.exports.NOT_FOUND = 404

/**
 * The server encountered an unexpected condition that prevented it from fulfilling the request.
 */
module.exports.INTERNAL_SERVER_ERR = 500

/**
 * The server is currently unable to handle the request due to a temporary overload or scheduled maintenance, which will likely be alleviated after some delay.
 */
module.exports.SVC_NOT_AVAIL = 503