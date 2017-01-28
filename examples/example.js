// You would set these via command line options or something, not in the code

// Try to find user name. If it doesn't work with a role error (28000), set this variable to your user name:
// const role = 'your_username'
const role = process.env.SUDO_USER ||
             process.env.LOGNAME || 
             process.env.USER || 
             process.env.LNAME || 
             process.env.USERNAME

// this'll probably need to be disabled. It should not be enabled during production though.
process.env.SSL_DISABLED = true

// you may need to edit this too
process.env.DATABASE_URL = `postgres://${role}@localhost:5432/`

// Now, for the actual code:
const query = require('../index.js')
const lib = {}

lib.setup = query.mapSingle(`
  CREATE TABLE IF NOT EXISTS users_example (id SERIAL, name text)
`)

lib.addUser = query.mapSingle(`
  INSERT INTO users_example (name) values ($1)
`, ['name'])

lib.getUsers = query.mapMultiple(`
  SELECT * from users_example
`)

lib.cleanup = query.mapSingle(`
DROP TABLE users_example
`)

lib.setup((err) => {
  if(err && err.code == '28000') {
    return console.log('(psql code 28000) Error connecting, bad role. Edit the example file to include the proper connection information for your psql server.')
  }

  // log errors
  if(err) return console.log(err)

  // get current user listr
  lib.getUsers((err, users) => {
    if(err) return console.log(err)
    // print it
    console.log('Initial Users', users)

    // add a user
    lib.addUser('Rich', (err) => {
      if(err) return console.log(err)

      // get users now.
      lib.getUsers((err, users) => {
        if(err) return console.log(err)

        // print result of demo
        console.log('Final Users', users)

        // cleanup
        lib.cleanup((err) => {
          if(err) console.log(err)
          process.exit(0)
        })
      })
    })
  })
})