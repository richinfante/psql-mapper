const fs = require('fs')
const crypto = require('crypto')
const Error = require('./lib/error')
const Status = require('./lib/status')

module.exports = function (options) {
  if(options === undefined) {
    throw new Error('Please provide an options object / psql database url')
  }

  // Connect to the databases
  const connect = require('./lib/connect')(options)

  var library = {}

  // Some logging flags
  const logStatus = options.debug
  const verboseLog = options.verbose_debug

  if (logStatus || verboseLog) {
    var cl = function(str, color) {
      return str[color] || str
    }
    try{
      require('colors')
    }catch(e) {
      console.log("Running without colors support. run `npm install colors` to enable.")
    }
  }
  /*
  * This module is designed to prepare queries to be used in a library.
  * The parametes for a map* call are as follows:
  * queryText: the text for a query,
  * optionNames: an array of names for mapping dictionary notation to the function.
  * When using map*(queryText, [optionNames, ...]), it returns a closure which can be called like so:
  *
  * for multiple options:
  * libFunction([value, value2, ...], (err, result) => {})
  * libFunction({
  *  option: value,
  *  option2: value2
  * }, (err, result) => {})
  *
  * or for one option:
  * libFunction(option, (err, result) => {})
  */

  /**
   * @module query
   * @description Utilities for mapping SQL queries to API functions
   */

  /**
   * Prepare a query, strip out the comments
   * @param {string} query query
   */
  function prepare (string, params) {
    if (params) {
      return {
        query: prepare(string),
        map: params
      }
    }
    // split by newlines, trim all alignment.
    // filter characters and empty lines away
    // join the rest with spaces, and trim final string.
    var query = string
      .split('\n')
      .map(el => el.trim())
      .filter((el) => {
        return el.indexOf('--') !== 0 && el !== ''
      })
      .join(' ')
      .trim()

    // We'll use the first 16 chars of the sha256 hash for the query name.
    var hash = crypto.createHash('sha256').update(string, 'utf8').digest().toString('hex').substring(0, 16)

    // Log the query.
    if (verboseLog) console.log(`${cl('pg[init]', 'yellow')} preparing ${cl(hash, 'yellow')} => "${cl(query, 'grey')}"`)
    
    return {
      name: hash,
      text: query
    }
  }

  /**
   * Load and prepare an sql file.
   * @param {string} filename - the filename to load
   * @returns {string} - the prepared sql (comment stripped, single line.)
   */
  library.load = function load (name, params) {
    return prepare(fs.readFileSync(name, 'utf8'), params)
  }

  /**
   * Execute a query that may or may not return one result.
   * @param {Object} query
   * @param {String} query.name - then name of the query
   * @param {String} query.text - the sql query
   * @param {Array} values - the values
   * @param {function(Error, Object)} callback
   */
  function querySingle (query, values, callback) {
    connect.quick({
      name: query.name,
      text: query.text,
      values: values
    }, (err, result) => {
      /* istanbul ignore next */
      if (err) return callback(err)

      // Send Result
      callback(undefined, result.rows[0])
    })
  }

  /**
   * Execute a query that may return exactly one result.
   * If no result is found, an error is thrown.
   * @param {Object} query
   * @param {String} query.name - then name of the query
   * @param {String} query.text - the sql query
   * @param {Array} values - the values
   * @param {function(Error, Object=)} callback
   */
  function querySingleStrict (query, values, callback) {
    connect.quick({
      name: query.name,
      text: query.text,
      values: values
    }, (err, result) => {
      /* istanbul ignore next */
      if (err) return callback(err)

      // Not Found
      if (result.rows.length === 0) return callback(new Error('Not Found', Status.NOT_FOUND))

      // Send Result
      callback(undefined, result.rows[0])
    })
  }

  /**
   * Execute a query that may return more than one result.
   * @param {Object} query
   * @param {String} query.name - then name of the query
   * @param {String} query.text - the sql query
   * @param {Array} values - the values
   * @param {function(Error, Array<Object>)} callback
   */
  function queryMultiple (query, values, callback) {
    connect.quick({
      name: query.name,
      text: query.text,
      values: values
    }, (err, result) => {
      /* istanbul ignore next */
      if (err) return callback(err)

      // Send Result
      callback(undefined, result.rows)
    })
  }

  /**
   * Map a dictionary? of key values to an array.
   * @param {any} dict provided values. can be `Array`, `Object`, or some value type.
   * @param {Array=} map order required by query. No parameter queries should leave this as undefined.
   */
  function mapParameters (dict, map) {
    if (logStatus) console.log(`${cl('pg[mapper]', 'green')} beginning parameter map.`)
    // If we pass in a dictionary, be sure to map it to the proper array.
    if (map === undefined || dict === undefined) {
      if (logStatus) console.log(`${cl('pg[mapper]', 'green')} using undefined values, no dictionary or map provided.`)
      return [] // If no parameters, set dict to empty array.
    } else if (typeof dict !== 'object') {
      if (logStatus) console.log(`${cl('pg[mapper]', 'green')} using singular value`, [dict])
      return [dict] // If one param (not array), set it to the parameter
    } else if (!(dict instanceof Array)) {
      if (logStatus) console.log(`${cl('pg[mapper]', 'green')} running linearmap.`)
      // Otherwise, map parameters to array.
      return map.map((el, i) => {
        if (logStatus) console.log(`${cl('pg[mapper]', 'green')} mapping ${el} @ ${i} to ${dict[el]}`)
        return dict[el]
      })
    } else {
      if (logStatus) console.log(`${cl('pg[mapper]', 'green')} using directmap. (not recommended)`)
      return dict
    }
  }

  /**
   * Create a library function for a query. Returns one result, may be null.
   *
   * @param {Object} query
   * @param {String} query.name - then name of the query
   * @param {String} query.text - the sql query
   * @param {Array<any>} map - array of names for parameters, in order.
   * @param {Object=} object - (optional) pass result into a constructor before returning
   * @returns {function(Object, function(Error, Object=))}
   */
  library.mapSingle = function mapSingle (query, map, Constructor) {
    // Ensure queries are prepared
    if (typeof query === 'string') {
      query = prepare(query)
    }
    // If the query has a map object, use it instead
    if (typeof query.map === 'object') {
      map = query.map
      query = query.query
    }

    return function (dict, callback) {
      // Make sure we are using the correct callback
      if (typeof dict === 'function') {
        callback = dict
        dict = undefined
      }

      // Map the parameters
      dict = mapParameters(dict, map)

      if (typeof Constructor !== 'function') {
        querySingle(query, dict, callback)
      } else {
        querySingle(query, dict, (err, result) => {
          if (err) return callback(err)

          // If we have a result, return it as an object
          if (result != null) return callback(err, new Constructor(result))

          return callback(undefined, null)
        })
      }
    }
  }

  /**
   * Create a library function for a query. Returns one result, may not null.
   * NOT_FOUND error is thrown if null.
   *
   * @param {Object} query
   * @param {String} query.name - then name of the query
   * @param {String} query.text - the sql query
   * @param {Array<any>} map - array of names for parameters, in order.
   * @param {Object=} object - (optional) pass result into a constructor before returning
   * @returns {function(Object, function(Error, Object))}
   */
  library.mapSingleStrict = function mapSingleStrict (query, map, Constructor) {
    // Ensure queries are prepared
    if (typeof query === 'string') {
      query = prepare(query)
    }
    // If the query has a map object, use it instead
    if (typeof query.map === 'object') {
      map = query.map
      query = query.query
    }
    
    return function (dict, callback) {
      // Make sure we are using the correct callback
      if (typeof dict === 'function') {
        callback = dict
        dict = undefined
      }

      // Map the parameters
      dict = mapParameters(dict, map)

      if (typeof Constructor !== 'function') {
        querySingleStrict(query, dict, callback)
      } else {
        querySingleStrict(query, dict, (err, result) => {
          if (err) return callback(err)

          // Result should never be null, singleStrict throws an error then.
          return callback(err, new Constructor(result))
        })
      }
    }
  }

  /**
   * Create a library function for a query. Returns any number of results.
   *
   * @param {Object} query
   * @param {String} query.name - then name of the query
   * @param {String} query.text - the sql query
   * @param {Array<any>} map - array of names for parameters, in order.
   * @param {Object=} Constructor - (optional) pass result into a constructor before returning
   * @returns {function(Object, function(Error, Array<Object>))}
   */
  library.mapMultiple = function mapMultiple (query, map, Constructor) {
    // Ensure queries are prepared
    if (typeof query === 'string') {
      query = prepare(query)
    }
    // If the query has a map object, use it instead
    if (typeof query.map === 'object') {
      map = query.map
      query = query.query
    }
    
    return function (dict, callback) {
      // Make sure we are using the correct callback
      if (typeof dict === 'function') {
        callback = dict
        dict = undefined
      }

      // Map the parameters
      dict = mapParameters(dict, map)

      if (typeof Constructor !== 'function') {
        queryMultiple(query, dict, callback)
      } else {
        queryMultiple(query, dict, (err, result) => {
          if (err) return callback(err)

          result.map((el) => {
            return new Constructor(el)
          })

          callback(err, result)
        })
      }
    }
  }

  library.prepare = prepare
  library.Status = Status
  library.Error = Error
  library.disconnect = connect.disconnect
  return library
}