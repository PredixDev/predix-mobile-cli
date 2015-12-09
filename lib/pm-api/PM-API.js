
'use strict';

var Promise = require('bluebird'); Promise.longStackTraces();
var HttpUtil = require("../http/HTTP-Util.js");
var RequestUtil = require('../http/RequestUtil.js');
var UAAConfig = require("../cf-api/UAA-Auth.js").UAAConfig.valueOf();
var Logging = require('../logging.js');
var logger = Logging.general.valueOf();
var UserState = require("../UserState.js");
var constsConfig = require("../../config.js");
var arrayUnion = require('array-union');
var arraySubtract = require('array-differ');
var path = require('path');
var fs = require('fs');
var stripJsonComments = require('strip-json-comments');

function PM_API() {
        
        function UpdateEndpoint(endpoint) {
                
                var endpointMissingScheme = (endpoint.toLowerCase().indexOf("https://") !== 0) && (endpoint.toLowerCase().indexOf("http://") !== 0)
                
                var finalEndpoint;
                if (endpointMissingScheme) {
                        finalEndpoint = "https://" + endpoint;
                        return attemptUpdate(finalEndpoint)
                        .spread(function (response, body) {
                                return Promise.resolve([response, body]);
                        }, function (response, body) {
                                finalEndpoint = "http://" + endpoint
                                return attemptUpdate(finalEndpoint)
                        });
                } else {
                        return attemptUpdate(endpoint)
                }
        }
        
        function attemptUpdate(endpoint) {
                var serverInfoAPIPath = constsConfig.server_cli_server_config_path.valueOf()
                
                // type endpointResource {
                // 	"api_version"
                // 	"authorization_endpoint"
                //      "admin_data_endpoint"
                //      "user_data_endpoint"
                //      "session_endpoint"
                // 	"min_cli_version"
                // 	"min_recommended_cli_version"
                // }
                
                var path = RequestUtil.ResolveURL(endpoint, serverInfoAPIPath);
                
                return HttpUtil.GetResource("GET", path)
                .spread(function (response, body) {
                        
                        // persist config for later use:
                        UserState.target.config = body;
                        
                        return Promise.resolve([response, body]);
                });
                
        }
        
        function EnsureRolesExistAndContainSelfChannel(nanoRepository, role_names) {
                
                logger.debug("[INFO] Validating roles:", role_names);
                
                return Promise.map(
                          role_names
                        , ValidateRole 
                        , {concurrency: 3}
                );
                
                function ValidateRole(role_name) {
                        // validate each role contains the expected channel, of the same name as the related role.
                        // create role if role not found.
        
                        logger.debug("[INFO] Validating role:", role_name);
                        
                        role_name = constsConfig.sanitize_role_name_filter(role_name);
                        var roleDocID = "_role/" + role_name;
                        
                        return nanoRepository.findByIdAsync(roleDocID)
                
                        // update role if present:
                        .then(function (roleDocument) {
                                
                                if (!roleDocument._id) roleDocument._id = roleDocID;
                                if (!roleDocument.admin_channels) roleDocument.admin_channels = [];
                
                                roleDocument.admin_channels = arrayUnion(roleDocument.admin_channels.valueOf(), [role_name.valueOf()]);
                                
                                return nanoRepository.saveOverAsync(roleDocument);
                        })
                
                        // try create role if not found:
                        .catch(function () {
                                logger.debug("[INFO] Creating role:", role_name);
                                
                                var roleDocument = {
                                          "_id": roleDocID
                                        , "name": role_name
                                        , "admin_channels": [role_name]
                                };
                                return nanoRepository.saveOverAsync(roleDocument);
                        });
        
                }
                
        }
        
        function ResetRolesAdminChannelList(nanoRepository, role_names, channel_list) {
                if (!channel_list) channel_list = [];
                
                return EnsureRolesExistAndContainSelfChannel(nanoRepository, role_names)
                .then(function () {
                        return Promise.map(
                                  role_names
                                , UpdateRole 
                                , {concurrency: 3}
                        );
                        
                        function UpdateRole(role_name) {
                                role_name = constsConfig.sanitize_role_name_filter(role_name);
                                var roleDocID = "_role/" + role_name;
                                
                                return nanoRepository.findByIdAsync(roleDocID)
                                .then(function (roleDocument) {
                                        if (!roleDocument._id) roleDocument._id = roleDocID;
                                        
                                        roleDocument.admin_channels = arrayUnion([roleDocument.name.valueOf()], channel_list);
                                        
                                        return nanoRepository.saveOverAsync(roleDocument);
                                });
                        }
                        
                });
        }
        
        function InitUserViaEntitlementService(userName) {
                
                var uaaConfig = new UAAConfig(UserState);
                var authHeaders = uaaConfig.GetSessionHeaders();
                
                var target_api = UserState.target.api.valueOf();
                var session_endpoint = UserState.target.config.session_endpoint.valueOf();
                var verify_user_path = constsConfig.server_cli_session_verify_user_pattern.valueOf();
                verify_user_path = verify_user_path.replace(/\{user_id\}/g, userName);
                
                var path = RequestUtil.ResolveURL(target_api, session_endpoint, verify_user_path);
                
                return HttpUtil.GetResource("GET", path, authHeaders)
                .spread(function (response, body) {
                        return Promise.resolve(body);
                }, function (response, body) {
                        logger.warn("Unable to initialize user via entitlement service:", userName, "; Detail:", Logging.SanitizeTrace(body || response));
                        return Promise.reject({error: "Unable to initialize user: " + userName});
                });
        }
        
        function EnsureDocumentIncludesChannels(document, channel_list) {
                
                var startChannels = document.channels || [];
                document.channels = arrayUnion(startChannels, channel_list || []);
                
                var didAnyChange = false;
                if (startChannels.length !== document.channels.length) {
                        didAnyChange = true;
                }
                return didAnyChange;
        }
        
        function RemoveChannelsFromDocument(document, channel_list) {
                
                var startChannels = document.channels || [];
                document.channels = arraySubtract(startChannels, channel_list || []);
                
                var didAnyChange = false;
                if (startChannels.length !== document.channels.length) {
                        didAnyChange = true;
                }
                return didAnyChange;
        }
        
        function DeriveAppDocumentID_FromAppDocument(app_document) {
                
                var appName = app_document.name.valueOf();
                var appVersion = app_document.version.valueOf();
                
                var id = "app-" + constsConfig.sanitize_app_name_filter(appName + "_" + appVersion);
                var latest = "app-" + constsConfig.sanitize_app_name_filter(appName + "_" + "latest");
                
                return {
                          versioned: id
                        , latest: latest
                };
        }
        
        function DeriveAppDocumentID_FromName(input_name) {
                
                var arr = input_name.split("@");
                var appName = arr[0].valueOf();
                var version = arr[1].valueOf();
                
                var id = "app-" + constsConfig.sanitize_app_name_filter(appName + "_" + version);
                
                return {
                        versioned: id
                };
        }
        
        function DrivePersonalChannelOfUser(input_name) {
                var userName = constsConfig.sanitize_username_filter(input_name);
                return "entity_" + userName;
        }
        
        function DeriveWebAppDocumentID_ByWebAppManifest(webAppManifest) {
                var name = webAppManifest.name.valueOf();
                var version = webAppManifest.version.valueOf();
                
                return DeriveWebAppDocumentID_ByNameAndVersion(name, version);
        }
        
        function DeriveWebAppDocumentID_ByNameAndVersion(name, version) {
                
                var document_id = "webapp-" + constsConfig.sanitize_app_name_filter(name + "_" + version);
                var latest = "webapp-" + constsConfig.sanitize_app_name_filter(name + "_" + "latest");
                
                return {
                          versioned: document_id
                        , latest: latest
                };
        }
        
        function TryResolveToPath(cwdPath, tryPath, _default_manifest_file_name) {
                
                var appFilePath = tryPath;
                if (!appFilePath) appFilePath = _default_manifest_file_name;
                var _app_file = path.resolve(cwdPath, appFilePath)
                
                if (fs.existsSync(_app_file) && fs.lstatSync(_app_file).isDirectory()) {
                        _app_file = path.resolve(_app_file, "./" + _default_manifest_file_name);
                }
                
                if (!_app_file || !fs.existsSync(_app_file)) {
                        return false;
                }
                
                return _app_file;
        }
        
        function SimpleReadAppDocument(localFilePath) {
                // read input file:
                var str = fs.readFileSync(localFilePath, "utf-8");
                if (!str) throw new Error("[ERROR] app document not found, or not accessible.");
                
                var document = JSON.parse(stripJsonComments(str)); 
        
                // simple validation:
                if (!document.name) throw new Error("[ERROR] Expected field `name` not found in app manifest.");
                if (!document.version) throw new Error("[ERROR] Expected field `version` not found in app manifest.");
                
                return document;
        }
        
        // exports:
        this.UpdateEndpoint = UpdateEndpoint;
        this.EnsureRolesExistAndContainSelfChannel = EnsureRolesExistAndContainSelfChannel;
        this.EnsureDocumentIncludesChannels = EnsureDocumentIncludesChannels;
        this.RemoveChannelsFromDocument = RemoveChannelsFromDocument;
        this.DeriveAppDocumentID_FromAppDocument = DeriveAppDocumentID_FromAppDocument;
        this.DeriveAppDocumentID_FromName = DeriveAppDocumentID_FromName;
        this.DrivePersonalChannelOfUser = DrivePersonalChannelOfUser;
        this.DeriveWebAppDocumentID_ByWebAppManifest = DeriveWebAppDocumentID_ByWebAppManifest;
        this.DeriveWebAppDocumentID_ByNameAndVersion = DeriveWebAppDocumentID_ByNameAndVersion;
        this.ResetRolesAdminChannelList = ResetRolesAdminChannelList;
        this.InitUserViaEntitlementService = InitUserViaEntitlementService;
        this.TryResolveToPath = TryResolveToPath;
        this.SimpleReadAppDocument = SimpleReadAppDocument;
        
}

module.exports = PM_API;

