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

// parse input:
program
    .version('1.0.1a')
    .usage('[app-file] [options]')
    .option('--debug', 'Set logging level to debug (more traces than "verbose")')
    .option('--verbose', 'Set logging level to verbose.')
    .parse(process.argv); 

var _default_manifest_file_name = constsConfig.default_app_manifest_file_name.valueOf();
var appFilePath = program.args[0];
var _app_file = PM_API.TryResolveToPath(process.cwd(), appFilePath, _default_manifest_file_name);

if (_app_file === false) {
    logger.error("No application descriptor could be detected.  Specify a path to an app.json file, a folder containing app.json, or `cd` to the folder which contains app.json, and execute `define` again.");
    return;
}

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
    
    var bootDocumentFilePath = _app_file;
    logger.info("[INFO] importing app document:", bootDocumentFilePath);
    
    var bootDocJSON;
    var _dependency_document_id_list = [];
    
    
    var _app_starter;
    var _app_offline;
    var _app_dependencies;
    var _dependencies_copy;
    
    return Promise.resolve(true)
    
    // read input file.
    .then(ReadAppDocument) 
    .catch(function (status) {
        console.error("[ERROR] App document could not be read:", bootDocumentFilePath, "; detail: ", status, ('stack' in status) ? status.stack : "" );
    })
    
    .then(EnsureReferencedDependenciesExist)
    
    // write document to datastore.
    .then(CommitAppDocument)  
    
    .then(UpdateAppDocumentRole)
    
    // completed.
    .then(function () {
        console.log("OK");
    })
    
    .then(GrantDocumentToActiveUser);
    
    
    // process methods:
    function ReadAppDocument() {
    
        // read input file:
        bootDocJSON = PM_API.SimpleReadAppDocument(bootDocumentFilePath);
        
         _app_starter = bootDocJSON.starter;
        if (!_app_starter) throw new Error("[ERROR] Expected field `starter` not found in app manifest.");
        if (!constsConfig.app_document_composite_id_validator(_app_starter)) throw new Error("[ERROR] `starter` field not in expected format of 'name@version' or 'name'");
        
        
        _app_offline = bootDocJSON.offline;
        if (_app_offline) {
            if (!constsConfig.app_document_composite_id_validator(_app_offline)) throw new Error("[ERROR] `offline` field not in expected format of 'name@version' or 'name'");
        }
        
        _app_dependencies = bootDocJSON["pm-wapp"] || bootDocJSON.dependencies;
        delete bootDocJSON["pm-wapp"];
        if (!_app_dependencies) throw new Error("[ERROR] Expected field `dependencies` not found in app manifest.");
        bootDocJSON.dependencies = _app_dependencies;
        _dependencies_copy = JSON.parse(JSON.stringify(_app_dependencies));
        
        // retain original untranslated values for reverse-lookup:
        // bootDocJSON.starter_original = _app_starter;    
        // if (_app_offline) bootDocJSON.offline_original = _app_offline;
        
        // translate identifiers:
        
        // starter:
        (function () {
            var list = _app_starter.split("@");
            var name = list[0];
            var version = list[1];
            
            if (!(name in _dependencies_copy)) throw new Error("[ERROR] Name specified in `starter` field not found in dependencies list of manifest.  Ensure a same-named entry exists in the `pm-wapps` or `dependencies` section of the manifest, and try again.");
            var referenced_version = _dependencies_copy[name];
            if (version === null || version === void(0)) version = referenced_version;
            
            if ((referenced_version + "") !== (version + "")) throw new Error("[ERROR] Version specified in `starter` field not found in dependencies list of manifest.  Ensure the version matches the entry found in the `pm-wapps` or `dependencies` section of the manifest, and try again.");
            
            // bootDocJSON.starter = PM_API.DeriveWebAppDocumentID_ByNameAndVersion(name, version).versioned.valueOf();
        })();
        
        // offline:
        if (_app_offline) {
             (function () {
                var list = _app_offline.split("@");
                var name = list[0];
                var version = list[1];
                
                if (!(name in _dependencies_copy)) throw new Error("[ERROR] Name specified in `offline` field not found in dependencies list of manifest.  Ensure a same-named entry exists in the `pm-wapps` or `dependencies` section of the manifest, and try again.");
                var referenced_version = _dependencies_copy[name];
                if (version === null || version === void(0)) version = referenced_version;
                
                if ((referenced_version + "") !== (version + "")) throw new Error("[ERROR] Version specified in `offline` field not found in dependencies list of manifest.  Ensure the version matches the entry found in the `pm-wapps` or `dependencies` section of the manifest, and try again."); 
                
                // bootDocJSON.offline = PM_API.DeriveWebAppDocumentID_ByNameAndVersion(name, version).versioned.valueOf();
            })();
        }
        
        // dependencies:
        (function () {
            Object.keys(_app_dependencies).forEach(function (name) {
                var version = _app_dependencies[name];
                _app_dependencies[name] = {
                      "version": version
                    , id: PM_API.DeriveWebAppDocumentID_ByNameAndVersion(name, version).versioned.valueOf()
                };
            });
        })();
        
        
        
        // add default fields:
        bootDocJSON.created_at = Date.now();
        bootDocJSON.updated_at = Date.now();
        
        // always mark a app document with ~read_only, for easy use by any sync-function restrictions which may be put in place:
        bootDocJSON['~read_only'] = true;
        
        // identifies this as an app document
        /* jshint -W069 */
        bootDocJSON['type'] = "app";
        
        // generate an ID of the 
        bootDocJSON['_id'] = PM_API.DeriveAppDocumentID_FromAppDocument(bootDocJSON).versioned.valueOf();
        
        // every app belongs to a channel, of the same name as the app.
        var document_id = bootDocJSON._id.valueOf();
        PM_API.EnsureDocumentIncludesChannels(bootDocJSON, [document_id]);
        
        return bootDocJSON;
    }
    
    function EnsureReferencedDependenciesExist() {
        return Promise.map(
              Object.keys(_dependencies_copy)
            , VerifyDependencyDocumentExists
            , {concurrency: 3}
        );
        
        function VerifyDependencyDocumentExists(name) {
            var version = _dependencies_copy[name];
            
            var document_id = PM_API.DeriveWebAppDocumentID_ByNameAndVersion(name, version).versioned.valueOf();
            
            _dependency_document_id_list.push(document_id);
            
            return repository.findByIdAsync(document_id)
            .then(function (document) {
                logger.info("Verified Dependency:", name + "@" + version);
            }, function () {
                logger.error("[ERROR] Dependency not deployed:", name + "@" + version, "; Use `pm publish` to deploy this required version, then try deploying this app again."); 
            });
            
        }
    }
    
    function CommitAppDocument(result) {
        
        var document_id = bootDocJSON._id.valueOf();
        
        return repository.findByIdAsync(document_id)
        .then(function (existingDocument) {
            
            bootDocJSON.created_at = existingDocument.created_at;
            bootDocJSON.channels = arrayUnion(bootDocJSON.channels || [], existingDocument.channels || []);
            bootDocJSON._rev = existingDocument._rev;
            
            return repository.saveOverAsync(bootDocJSON);
        }, function () {
            return repository.saveOverAsync(bootDocJSON); 
        });
    }
    
    function UpdateAppDocumentRole() {
        
        var role_name = bootDocJSON._id.valueOf();
        
        return PM_API.ResetRolesAdminChannelList(repository, [role_name], _dependency_document_id_list);
    }
    
    function GrantDocumentToActiveUser() {
        var user_name = uaaConfig.LastSessionCheckToken().user_name.valueOf();        
        
        var _app_name = bootDocJSON.name.valueOf();
        var _app_version = bootDocJSON.version.valueOf();

        logger.info("Granting App to current authenticated user:", user_name);

        // execute import:
        return AdjustAppPermissionsCommand.Execute({
              _app_name: (_app_name + "@" + _app_version)
            , _add_role_names: []
            , _add_user_names: [user_name]
            , _remove_role_names: []
            , _remove_user_names: []
        });
        
    }
    
    
}

