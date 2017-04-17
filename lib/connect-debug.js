const debug = require('sql:input')
const debugVerbose = require('sql:all')
module.exports = function (pool, options) {
  var library = {}

  // Verbose logging version for debugging
  /**
   * Database Connect (DEBUG)
   * @param {function(err, client,done)} - callback function
   */
  /* istanbul ignore next */
  try {
    require('colors')
  } catch (e) {
    console.log("Running without colors support. run `npm install colors` to enable.")
  }

  /* istanbul ignore next */
  library = function connect(callback) {
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
            debug(`${name} run: ${plan.name}`)
            debug(`${name} text: ${plan.text}`)
            return client.query(plan, function (err, result) {
              // Calculate end time
              const endTime = Date.now() - startTime

              // Print end time
              debug(`${name} time: ${endTime}ms`)

              // Print result
              if (err) {
                console.log(`${name} error:`, err)
                console.log(err.stack)
              } else if (process.env.DEBUG_SQL === 'input') {
                debug(`${name} params: ${plan.values}`)
              } else if (process.env.DEBUG_SQL === 'all') {
                debugVerbose(`${name} params: ${plan.values}`)
                debugVerbose(`${name} result: ${result.rows}`)
              }

              return callback(err, result)
            })
          }
        }, done)
      })
    })
  }

  /* istanbul ignore next */
  library.quick = function (options, callback) {
    library((err, client, done) => {
      if (err) return callback(err)

      return client.query(options, function (err, result) {
        // client.end()
        done()
        return callback(err, result)
      })
    })
  }

  library.disconnect = function () {
     pool.end()
  }

  return library
}