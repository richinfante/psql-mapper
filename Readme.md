# Psql-mapper
psql-mapper is designed to allow quick and easy creation of libraries that interact with databases. **NOTE: this module is experimental. use at your own risk!**

## Exported Methods:
### Prepare
```js
query.prepare('SQL String', ['p1', 'p2'])
```
- Sql String is a string with parameterized variables.
- The second parameter is an array of option names that corrospond to the `$1`, `$2`, ... parameterized variables in the query. The first item in the options array corrosponds to `$1`, the second to `$2`, etc. These names are the names that are specified when a library function is called with options.
- It returns a dictionary to be passed into one of the exported map functions. 

### Load
```js
query.load('./filename.sql', ['p1', 'p2'])
```

### Map methods
```js
query.mapSingle(preparedQuery, options?)
query.mapSingleStrict(preparedQuery, options?)
query.mapMultiple(preparedQuery, options?)
```
- The options array doesn't need to be provided if it is provided when the query is prepared.
- "Single" ones return the first object
- "Multiple" ones return an array of objects
- The "singleStrict" will throw an error if there isn't a result, only the first result is returned so it's best to do `LIMTI ` on these queries for preformance sake.


## Basic Usage
```js
const query = require('psql-mapper')

module.exports.getItem = query.mapSingle(`
  SELECT * from items
  WHERE item_uuid = $1
`, ['item_uuid'])

module.exports.getItemAdvanced = query.mapSingle(`
  SELECT * from items
  WHERE item_uuid = $1, created_by = $2
`, ['uuid', 'createdBy'])
```

You can then call the library from another file:

```js
// Get an item from the database.
library.getItem('E779EB67-90B4-4743-A1AB-A8FFAC598E62', (err, item) => {
  console.log(err, item)
})

// If there are multiple parameters, use of an options object is required:
library.getItemAdvanced({
  'uuid' : 'E779EB67-90B4-4743-A1AB-A8FFAC598E62',
  'createdBy' : 'B56E00F6-D228-41D3-8A38-6E6C7571AF05'
}, (err, item) => {
  console.log(err, item)
})
```

## More complex usage
If your project is complex, it may be beneficial to seperate queries and mappings to maintain code clarity.

In one file, let's call it `queries.js`:

```js
const query = require('psql-mapper')

/**
* Parameters: (item_uuid)
* Export the prepared sql function
*/
module.exports.GET_ITEM = query.prepare(`
  SELECT * from items
  WHERE item_uuid = $1
`, ['item_uuid'])
```

In your `library.js` file:

```js
const query = require('psql-mapper')
const queries = require('./queries')

/**
* @function getItem
* Load an item from the database
*
* @param {String} item_uuid uuid
*/
module.exports.getItem = mapSingle(queries.GET_ITEM)
```

## Examples
- There's an example in the `examples/` folder to see how this all works. It might require some tweaking to connect to databases on your system though. It creates a table named `users_example` and inserts a record into it. Afterwards, it drops the table to cleanup.

```bash
node examples/example.js
```

If you'd like to see a printout of what's happening, enable debug like this:

```bash
DEBUG_SQL=all node examples/example.js
```

## Configuration variables
- `DATABASE_URL` - connection string: `postgres://user@hostname:port` format
- `PG_MAX_POOL_SIZE` - maximum number of psql clients in pool (default 20)
- `PG_MIN_POOL_SIZE` - minimum number of psql clients in pool (default 4)
- `SSL_DISABLED` - is ssl disabled? default `false`. This should not be set to true in production, but may be useful for local debugging.
- `PG_IDLETIMEOUT_MS` - How long (in ms) will a client wait before being closed if idle.
- `DEBUG_SQL` - Log sql queries (default: `false`) accepted values (`false`, `all`, `input`)
  - `false` - no logging
  - `input` - log queries / inputs
  - `all` - maximum logging.


## What's happening internally?
Internally, each sql query is assigned a name based on it's sha256 hash, so there's no naming conflicts between queries. Queries are stripped of newlines and comment lines first, and then hashed to generate this value.

Next, a function is retuned which calls one of the three psql functions to create output. We use the array of names provided with the original query to transform the dictionary of values into an array for psql to use.

## Licence
MIT Licence

## TODO
- Tests

(c) 2017 Rich Infante. All Rights Reserved.