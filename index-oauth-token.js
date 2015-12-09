#!/usr/bin/env node

'use strict';

var Logging = require("./lib/logging.js");
var logger = Logging.general.valueOf();
var program = require('commander');
var UserState = require("./lib/UserState.js");
var UAAConfig = require("./lib/cf-api/UAA-Auth.js").UAAConfig.valueOf();
var UAA = require("./lib/cf-api/UAA-Auth.js").UAA.valueOf();
var HttpUtil = require("./lib/http/HTTP-Util.js");
var RequestUtil = require("./lib/http/RequestUtil.js");

// parse input: 
program
  .usage('')
  .option('--debug', 'Set logging level to debug (more traces than "verbose")')
  .option('--verbose', 'Set logging level to verbose.')
  .parse(process.argv);

var _username = program.args[0];
var _password = program.args[1];

if (!UserState.target.api) { logger.error("API target not specified.  See 'pm api <api>' command."); return; }

// execute input:

// check UAA endpoint known:
var uaaConfig = new UAAConfig(UserState);
if (!uaaConfig.AuthenticationEndpoint()) { logger.error("Auth token not found.  See 'pm auth' command to login."); return; }

// attempt authenticate user:
Execute();

function Execute() {
	
	var uaaInstance = new UAA(uaaConfig);
	
	logger.info("Getting OAuth token...");
	
	// validate token is still valid:
	return uaaInstance.CheckToken()
	.spread(function (response, body) {
		return uaaConfig.AccessToken();
		
	}, function (response, body) {
		if (response.statusCode.valueOf() !== 200) {
			response.error = "Existing token is not valid, or session has expired.  Try `pm auth` to login again.";
			return Promise.reject([response, body]);
		}
		 
	})
	.then(function (access_token) {
		logger.info("OK");
		console.log();
		
		console.log(access_token);
		
	})
	.catch(function () {
		return true;
	});
	
}
