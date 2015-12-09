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
  .usage('<username> <password>')
  .option('--debug', 'Set logging level to debug (more traces than "verbose")')
  .option('--verbose', 'Set logging level to verbose.')
  .parse(process.argv);

var _username = program.args[0];
var _password = program.args[1];

if (!_username) { logger.error("Username argument not specified."); return; }
if (!_password) { logger.error("Password argument not specified."); return; }
if (!UserState.target.api) { logger.error("API target not specified.  See 'pm api <api>' command."); return; }

// execute input:

// check UAA endpoint known:
var uaaConfig = new UAAConfig(UserState);
if (!uaaConfig.AuthenticationEndpoint()) {
  var authorization_endpoint = UserState.target.config.authorization_endpoint.valueOf();
  uaaConfig.SetAuthenticationEndpoint(authorization_endpoint);
}

// attempt authenticate user:
var uaaInstance = new UAA(uaaConfig);
Execute();

function Execute(username, password) {
	uaaConfig.ClearSession();
	
	return uaaInstance.GetLoginPromptsAndSaveUAAServerURL()
	.then(function (prompts) {
		logger.info("API endpoint: ", uaaConfig.AuthenticationEndpoint());
		
		logger.info("Authenticating...");
	
		return uaaInstance.Authenticate({"username": _username, "password": _password})
		.spread(function (response, body) {
			console.log("OK");
			// console.log();
		}, function (response, body) {
			if (body) {
				logger.error("Authentication Error:", body);
			} else {
				logger.error("Authentication Error:", Logging.SanitizeTrace(response));
			}
			return true;
		});
	});

}
