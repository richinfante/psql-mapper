const pg = require('pg')
const url = require('url')
const params = url.parse(process.env.DATABASE_URL)
const auth = params.auth.split(':')

const pool = new pg.Pool({
  user: auth[0],
  password: auth[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1],
  max: Number(process.env.PG_MAX_POOL_SIZE) || 20, // set pool max size to 20
  min: Number(process.env.PG_MIN_POOL_SIZE) || 4, // set min pool size to 4
  ssl: (process.env.SSL_DISABLED !== 'true'), // Always enable SSL unless explicitly Disabled
  idleTimeoutMillis: Number(process.env.PG_IDLETIMEOUT_MS) || 3000 // how long a client can be idle
})

/* istanbul ignore next */
pool.on('error', function (err, client) {
  // if an error is encountered by a client while it sits idle in the pool
  // the pool itself will emit an error event with both the error and
  // the client which emitted the original error
  // this is a rare occurrence but can happen if there is a network partition
  // between your application and the database, the database restarts, etc.
  // and so you might want to handle it and at least log it out
  console.error('idle client error', err.message, err.stack)
})
/**
 * Accepts two values for DEBUG_SQL environment variable
 * true: log query names and runtimes
 * all: log query names, runtimes, and results.
 */
if (process.env.DEBUG_SQL === 'true' || process.env.DEBUG_SQL === 'all' || process.env.DEBUG_SQL === 'input') {
  // Verbose logging version for debugging
  /**
   * Database Connect (DEBUG)
   * @param {function(err, client,done)} - callback function
   */
  /* istanbul ignore next */
  try{
    require('colors')
  }catch(e) {
    console.log("Running without colors support. run `npm install colors` to enable.")
  }

  /* istanbul ignore next */
  module.exports = function connect (callback) {
    pool.connect(function (err, client, done) {
      if (err) console.log(err)

      require('crypto').randomBytes(2, function (err, buffer) {
        // Create a id for this pg call from 0000 - FFFF
        const token = buffer.toString('hex')
        
        var name = ('pg[pool.' + token + ']')
        name = name.blue || name

        // Get the time so we can log query time
        const startTime = Date.now()
        callback(err, {
          end: client.end,
          connection: client.connection,
          query: function (plan, callback) {
            console.log(name, 'run:', plan.name)
            console.log(name, 'text:', plan.text)
            return client.query(plan, function (err, result) {
              // Calculate end time
              const endTime = Date.now() - startTime

              // Print end time
              console.log(name, 'time:', endTime + 'ms')

              // Print result
              if (err) {
                console.log(name, 'error:', err)
                console.log(err.stack)
              } else if (process.env.DEBUG_SQL === 'input') {
                console.log(name, 'params:', plan.values)
              } else if (process.env.DEBUG_SQL === 'all') {
                console.log(name, 'params:', plan.values)
                console.log(name, 'result:', result.rows)
              }

              return callback(err, result)
            })
          }
        }, done)
      })
    })
  }

  /* istanbul ignore next */
  module.exports.quick = function (options, callback) {
    module.exports((err, client, done) => {
      if (err) return callback(err)

      return client.query(options, function (err, result) {
        // client.end()
        done()
        return callback(err, result)
      })
    })
  }
} else {
  /**
   * Database Connect
   * Preformant version for production
   * @param {function(err, client,done)} - callback function
   */
  module.exports = function connect (callback) {
    pool.connect(function (err, client, done) {
      /* istanbul ignore next */
      if (err) return callback(err)

      callback(err, client, done)
    })
  }

  module.exports.quick = function (options, callback) {
    module.exports((err, client, done) => {
      /* istanbul ignore next */
      if (err) return callback(err)

      return client.query(options, function (err, result) {
        // client.end()
        done()
        return callback(err, result)
      })
    })
  }
}
