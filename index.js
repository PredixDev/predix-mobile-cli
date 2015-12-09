#!/usr/bin/env node

'use strict';

var program = require('commander');

// declare programs:
program
  .version('1.1.2')

  // pending:
  // .command('target', 'Set or view the targeted PM server')
  // .command('login', 'Log user in')
  // .command('logout', 'Log user out')
  // .command('report', 'Produce reports')

  .command('api', 'Set or view the targeted PM server')
  .command('auth', 'Authenticate user non-interactively')

  .command('import', 'Import an initial dataset')
  .command('publish', 'Deploy a pm-webapp')
  .command('define', 'Deploy a pm-app')

  .command('grant', 'Grant a user access to a pm-app')
  .command('revoke', 'Revoke a user\'s access to a pm-app')
  
  .command('oauth-token', 'Retrieve and display the OAuth token for the current session')
  
  .command('add-route', 'Add a command-route for the command-processor.')
  .command('remove-route', 'Remove a command-route from the command-processor.')
  .command('routes', 'List all current command-routes.')
  
  .parse(process.argv);
