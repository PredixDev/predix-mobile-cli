#!/usr/bin/env node

'use strict';

var Logging = require("./lib/logging.js");
var program = require('commander-lm');
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
    .usage('[options]')
    .option('--debug', 'Set logging level to debug (more traces than "verbose")')
    .option('--verbose', 'Set logging level to verbose.')
    .parse(process.argv); 

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
        // var commandProcessors = document.COMMAND_PROCESSORS.valueOf();
        // 
        // for (var i = 0; i < commandProcessors.length; i++) {
        //     var item = commandProcessors[i];
        //    
        //     var serviceName = item['service-name']
        //     var uri = item['credentials']['url'];
        //    
        //     console.log("service:", serviceName, uri);
        // }
        
        var serviceMapping = document.SERVICE_MAPPING.valueOf();
        var commandProcessors = document.COMMAND_PROCESSORS.valueOf();
        
        console.log();
        for (var i = 0; i < serviceMapping.length; i++) {
            var item = serviceMapping[i];
            
            var serviceName = item['service-name']
            var routeStr = item['uri'];
            
            var command_item = GetProcessorByServiceName(serviceName);
            
            var service_url = "";
            if (command_item) {
                service_url = command_item['credentials']['url'];
            }
            
            console.log("route:", routeStr, "\t", service_url);
        }
        console.log();
        console.log("total routes:", serviceMapping.length);
        
        function GetProcessorByServiceName(name) {
            
            for (var i = 0; i < commandProcessors.length; i++) {
                var item = commandProcessors[i];
                if (item['service-name'] === name) {
                    return item;
                }
            }
            return null;
        }
        
    })
    
    // completed.
    .then(function () {
        console.log("OK");
    })
    ;
    
}

