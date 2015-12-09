#!/usr/bin/env node

'use strict';

var Logging = require("./lib/logging.js");
var logger = Logging.general.valueOf();
var program = require('commander');
var UserState = require("./lib/UserState.js");
var UAAConfig = require("./lib/cf-api/UAA-Auth.js").UAAConfig.valueOf();
var PM_Nano = require("./lib/pm-nano/PM-Nano.js");
var PM_API = new (require("./lib/pm-api/PM-API.js"))();
var path = require("path");
var fs = require("fs");
var url = require("url");
var stripJsonComments = require('strip-json-comments');
var constsConfig = require("./config.js");
var Promise = require('bluebird'); Promise.longStackTraces();
var arrayUnion = require('array-union');
var globAsync = Promise.promisify(require('glob'));
var zipAsync = require('./lib/SimpleZip.js');
var mkdirp = require('mkdirp');

// parse input:


program
    .usage('[webapp-manifest] [options]')
    // .option('-a, --app [appname]', 'Add WebApp to specified App name.  Can be repeated multiple times.', collect, [])
    // .option('-ra, --remove-app [appname]', 'Remove WebApp from specified App name.  Can be repeated multiple times.', collect, [])
    .option('--debug', 'Set logging level to debug (more traces than "verbose")')
    .option('--verbose', 'Set logging level to verbose.')
    .parse(process.argv);

var _app_file;

var _default_manifest_file_name = constsConfig.default_webapp_manifest_file_name.valueOf();

var appFilePath = program.args[0];
if (!appFilePath) appFilePath = _default_manifest_file_name;        
_app_file = path.resolve(process.cwd(), appFilePath);

if (fs.existsSync(_app_file) && fs.lstatSync(_app_file).isDirectory()) {
    _app_file = path.resolve(_app_file, "./" + _default_manifest_file_name);
}

function collect(val, memo) {
	memo.push(val);
	return memo;
}

if (!_app_file || !fs.existsSync(_app_file)) {
    logger.error("No web-application descriptor could be detected.  Specify a path to a `webapp.json` file, or `cd` to the folder which contains `webapp.json`, and execute `pm publish` again.");
    return;
}

// if (
//           (!program.app || (program.app.length === 0))
//        && (!program.removeApp || (program.removeApp.length === 0))
// ) {
//     logger.error("No app names specified.  Try adding at least one `--app <appname>` or `--remove-app <appname>` parameter.");
//     return;
// }

if (!UserState.target.api) { logger.error("API target not specified.  See 'pm api <api>' command."); return; }

// var _add_app_names = program.app || [];
// var _remove_app_names = program.removeApp || [];

// execute import:
Execute();

function Execute() {
    
    var uaaConfig = new UAAConfig(UserState);
    var authHeaders = uaaConfig.GetSessionHeaders();
    var admin_data_endpoint = UserState.target.config.admin_data_endpoint.valueOf();
    var server_url = url.resolve(UserState.target.api, admin_data_endpoint);
    
    var pmNano = new PM_Nano(server_url, constsConfig.pm_default_data_bucket_name.valueOf(), authHeaders);
    var nanoAsync = pmNano.GetNano();
    var nanoNonPromise = pmNano.GetNanoNonAsync();
    var repository = pmNano.GetNanoRepository();
    
    var bootDocumentFilePath = _app_file;
    logger.info("[INFO] importing web-app descriptor:", bootDocumentFilePath);
    
    var bootDocJSON;
    var bootDocID;
    var _zip_file_path;
    
    Promise.resolve(true)
    
    // read input file.
    .then(process__readDocument) 
    .catch(function (status) {
        console.error("[ERROR] WebApp document could not be read:", bootDocumentFilePath, "; detail: ", status, ('stack' in status) ? status.stack : "" );
    })
    
    // detect document ID.  Use the _id field of the input document, or default to the name of the file if _id is not found:
    .then(PackageZipFile)
    
    // write document to datastore.
    .then(UploadAppToServer) 
    
    // completed.
    .then(function () {
        console.log("OK");
    });
    
    
    // process methods:
    function process__readDocument() {
    
        // read input file:
        var str = fs.readFileSync(bootDocumentFilePath, "utf-8");
        if (!str) throw new Error("[ERROR] WebApp document not found, or not accessible.");
        
        bootDocJSON = JSON.parse(stripJsonComments(str)); 
        
        // add default fields:
        bootDocJSON.created_at = Date.now();
        bootDocJSON.updated_at = Date.now();
        
        // identifies this as an app document
        /* jshint -W069 */
        bootDocJSON['type'] = "webapp";
        
        // generate an ID of the 
        bootDocJSON['_id'] = PM_API.DeriveWebAppDocumentID_ByWebAppManifest(bootDocJSON).versioned.valueOf();
        
        if (!bootDocJSON.channels) bootDocJSON.channels = [];
        
        return bootDocJSON;
    }
    
    function PackageZipFile(document) {
        if (!document.name) return Logging.ErrorAndReject("[ERROR] Webapp manifest does not contain a `name` field.");
        if (!document.version) return Logging.ErrorAndReject("[ERROR] Webapp manifest does not contain a `version` field.");
        if (!document.main) return Logging.ErrorAndReject("[ERROR] Webapp manifest does not contain a `main` field.");
        if (!document['src-folder']) return Logging.ErrorAndReject("[ERROR] Webapp manifest does not contain a `src-folder` field."); 
        if (!document['output-folder']) return Logging.ErrorAndReject("[ERROR] Webapp manifest does not contain a `output-folder` field.");
        
        var baseDir = path.dirname(bootDocumentFilePath);
        
        var srcFolderPath = path.resolve(baseDir, document['src-folder']);
        var outputFolderPath = path.resolve(baseDir, document['output-folder']);
        
        var outputFileName = "app-" + document.name + "_" + document.version + ".zip"; 
        var outputFilePath = path.resolve(outputFolderPath, outputFileName);
        
        _zip_file_path = outputFilePath;
        
        mkdirp.sync(outputFolderPath);
        
        return zipAsync(
              [{root: srcFolderPath, files: [srcFolderPath]}]
            , outputFilePath
        )
        .then(function () {
            logger.info("[INFO] Zip created at path:", outputFilePath)
        }, function (status) {
            logger.error("[ERROR] Fault during zip generation: ", status);
        });
    }
    
    function UploadAppToServer(zipFilePath) {
        
        var document = JSON.parse(JSON.stringify(bootDocJSON));
        
        // remove fields not required from the public manifest.  
        delete document['src-folder'];
        delete document['output-folder'];
        
        return FetchCurrentDocument()
        .then(function (existingDocument) {
            
            document.created_at = existingDocument.created_at;
            document.channels = existingDocument.channels || [];
            
            return SaveDocument(document);
        }, function () {
            return SaveDocument(document); 
        })
        .then(FetchCurrentDocument)
        .then(RemoveExistingZipFiles)
        .then(AttachNewZipFile);
        
        function FetchCurrentDocument() {
            return repository.findByIdAsync(document._id);
        }
        
        function SaveDocument(document) {
            
            PM_API.EnsureDocumentIncludesChannels(document, [document._id]);
            // PM_API.EnsureDocumentIncludesChannels(document, _add_app_names);
            // PM_API.RemoveChannelsFromDocument(document, _remove_app_names);
            
            return repository.saveOverAsync(document); 
        }
        
        function RemoveExistingZipFiles(document) {
            if (document._attachments) {
                return Promise.map(
                      Object.keys(document._attachments)
                    , DeleteAttachment
                    , {concurrency: 1}
                );
            }
            
            function DeleteAttachment(key) {
                return repository.RetryUntilNot409Async(
                      document._id
                    , function (document) {
                        return nanoAsync.attachment.destroy(
                              document._id.valueOf()
                            , key
                            , {rev: document._rev.valueOf()}
                        );
                    }
                );
            }
            
        }
        
        function AttachNewZipFile(document) {
            
            if (!_zip_file_path) throw new Error("unexpected missing value: _zip_file_path");
            
            var fileBaseName = path.basename(_zip_file_path);
            
            return new Promise(function (resolve, reject) {
                fs.createReadStream(_zip_file_path.valueOf())
                .pipe(
                    nanoNonPromise.attachment.insert(
                          document._id.valueOf()
                        , fileBaseName
                        , null
                        , 'application/octet-stream'
                        , {rev: document._rev.valueOf()}
                        , function (err, result) {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve(result);
                        }
                    )
                );
            });
            
        }
        
    }
    
    
}

