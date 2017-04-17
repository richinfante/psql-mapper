const pg = require('pg')
const url = require('url')

module.exports = function(options) {
  // A string for database_url can be passed in as option also.
  if(typeof options === 'string') {
    options = {
      databaseUrl: options
    }
  }

  // Parse the parameters.
  const params = url.parse(options.databaseUrl || process.env.DATABASE_URL)
  const auth = params.auth ? params.auth.split(':') : []

  // Create a pool
  const pool = new pg.Pool({
    user:     options.user     || auth[0],
    password: options.password || auth[1],
    host:     options.hostname || params.hostname,
    port:     options.port     || params.port,
    database: options.database || params.pathname.split('/')[1],
    max:      options.pool_max || 20, // set pool max size to 20
    min:      options.pool_min || 0, // set min pool size to 4
    ssl:      (options.ssl == null || options.ssl), // Always enable SSL unless explicitly Disabled
    idleTimeoutMillis: options.pool_timeout || 3000 // how long a client can be idle
  })

  // Log idle client errors (usally network/other wierd issues)
  pool.on('error', function (err, client) {
    console.error('idle client error', err.message, err.stack)
  })


  var library = {}

  /**
   * Accepts two values for DEBUG_SQL environment variable
   * true: log query names and runtimes
   * all: log query names, runtimes, and results.
   */
  if (options.debug === true) {
    // Load the debug version.
   library = require('./connect-debug')(pool, options)
  } else {
    /**
     * Database Connect
     * Preformant version for production
     * @param {function(err, client,done)} - callback function
     */
    library = function connect (callback) {
      pool.connect(function (err, client, done) {
        /* istanbul ignore next */
        if (err) return callback(err)

        callback(err, client, done)
      })
    }

    library.quick = function (options, callback) {
      pool.connect().then(client => {
        client.query(options)
        .then(res => {
          client.release();
          callback(undefined, res)
        })
        .catch(err => {
          if(client.release) client.release()
          callback(err)
        })
      })
    }
  }

  library.disconnect = function () {
     pool.end()
  }

  return library
}