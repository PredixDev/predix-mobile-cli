#!/usr/bin/env node

'use strict';

var Logging = require("./lib/logging.js");
var logger = Logging.general.valueOf();
var program = require('commander-lm');
var UserState = require("./lib/UserState.js");
var URLRegex = require('./lib/url-regex/url-regex.js');
var PM_API = new (require("./lib/pm-api/PM-API.js"))();

// parse input: 
program
    .usage('[api] [options]' + '\n\t' + 'If no API is provided, the current API target will be traced.')
    .option('--unset', 'Remove all api endpoint targeting')
    .option('--skip-ssl-validation', 'Ignore TLS certificate validation errors.')
    .option('--debug', 'Set logging level to debug (more traces than "verbose")')
    .option('--verbose', 'Set logging level to verbose.')
    .parse(process.argv);

var _api = program.args[0];

if (!_api) {
    logger.info("API>", UserState.target.api);
    return;
}

// execute: --unset
if (program.unset) {
    UserState.target = {};
    UserState.uaa = {};
    logger.info("All API endpoint information unset.");
    return;
}

// execute: <api>
_api = _api.trim();
if (!URLRegex({exact: true}).test(_api)) {
    logger.error("Specified API URI not detected as valid, does not pass url-regex test.  API:", _api);
    return;
}

setApiEndpoint(_api)
.then(function () {
    console.log("OK");
}, function () {
    logger.error("[ERROR] An error was encountered;  The operation could not be completed successfully.");
    return true;
});

function setApiEndpoint(endpoint) {
    
    if (/\/$/.test(endpoint)) { // trim "/" from end, if present.
        endpoint = endpoint.substring(0, endpoint.length - 1);
    }
    
    UserState.target.api = "";
    UserState.uaa = {};
    
    return PM_API.UpdateEndpoint(endpoint)
    .spread(function (response, body) {
        
        // set the target if the information retrieval request is successful:
        UserState.target.api = endpoint;
        
        logger.info("API>", endpoint);
        
        logger.info("Configuration>", JSON.stringify(UserState.target, null, 4));
        
    }, function (response, body) {
        
       logger.error("[ERROR]", "Unexpected response from API information endpoint:", endpoint, "; Response Detail:", "Response:", Logging.SanitizeTrace(response), "; Body:", body);
       
    });
    
}


