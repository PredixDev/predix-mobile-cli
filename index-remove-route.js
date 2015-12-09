#!/usr/bin/env node

'use strict';

var Logging = require("./lib/logging.js");
var program = require('commander');
var UserState = require("./lib/UserState.js");
var UAA = require("./lib/cf-api/UAA-Auth.js").UAA.valueOf();
var UAAConfig = require("./lib/cf-api/UAA-Auth.js").UAAConfig.valueOf();
var logger = Logging.general.valueOf();
var PM_Nano = require("./lib/pm-nano/PM-Nano.js");
var PM_API = new (require("./lib/pm-api/PM-API.js"))();
var path = require("path");
var fs = require("fs");
var stripJsonComments = require('strip-json-comments');
var constsConfig = require("./config.js");
var Promise = require('bluebird'); Promise.longStackTraces();
var arrayUnion = require('array-union');
var url = require('url');
var AdjustAppPermissionsCommand = require("./lib/pm-commands/AdjustAppPermissionsCommand.js");
var PMRouterConfig = require("./lib/pm-api/PMRouterConfig.js");


// parse input:
program
    .usage('<command-route> [options]')
    .option('--debug', 'Set logging level to debug (more traces than "verbose")')
    .option('--verbose', 'Set logging level to verbose.')
    .parse(process.argv); 

var _processorRoute = program.args[0];

if (!_processorRoute) { logger.error("<command-route> argument not specified."); return; }
if (!UserState.target.api) { logger.error("API target not specified.  See 'pm api <api>' command."); return; }

// execute import:
Execute();

function Execute() {
    
    var uaaConfig = new UAAConfig(UserState);
    var authHeaders = uaaConfig.GetSessionHeaders();
    var admin_data_endpoint = UserState.target.config.admin_data_endpoint.valueOf();
    var server_url = url.resolve(UserState.target.api, admin_data_endpoint); 
    
    var pmNano = new PM_Nano(server_url, constsConfig.pm_default_data_bucket_name.valueOf(), authHeaders);
    var repository = pmNano.GetNanoRepository();
    
    var pmRouterConfig = new PMRouterConfig(logger, repository);
    
    return pmRouterConfig.GetConfig()
    .then(function (document) {
        
        // var _processorName = _processorURL.split(":/").pop();
        // _processorName = _processorName.replace(/[^a-z0-9\.]/ig, "_");
        
        var didRemoveRoute = pmRouterConfig.RemoveRoute(_processorRoute);
        
        if (didRemoveRoute) {
            console.log("route removed:", _processorRoute);
        } else {
            console.log("FAULT: route not found:", _processorRoute);
        }
        
        return pmRouterConfig.SetConfig();
    })
    
    // completed.
    .then(function () {
        console.log("OK");
    })
    ;
    
}

