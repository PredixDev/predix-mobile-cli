'use strict';

var UserState = require("../UserState.js");
var UAAConfig = require("../cf-api/UAA-Auth.js").UAAConfig.valueOf();
var Logging = require("../logging.js");
var logger = Logging.general.valueOf();
var PM_API = new (require("../pm-api/PM-API.js"))();
var PM_Nano = require("../pm-nano/PM-Nano.js");
var path = require("path");
var fs = require("fs");
var url = require("url");
var stripJsonComments = require('strip-json-comments');
var constsConfig = require("../../config.js");
var Promise = require('bluebird'); Promise.longStackTraces();
var arrayUnion = require('array-union');
var arraySubtract = require('array-differ');

function Execute(options) {
    
    var _app_name = options._app_name.valueOf();
    var _add_role_names = options._add_role_names.valueOf();
    var _add_user_names = options._add_user_names.valueOf();
    var _remove_role_names = options._remove_role_names.valueOf();
    var _remove_user_names = options._remove_user_names.valueOf();
    
    var uaaConfig = new UAAConfig(UserState);
    var authHeaders = uaaConfig.GetSessionHeaders();
    var admin_data_endpoint = UserState.target.config.admin_data_endpoint.valueOf();
    var server_url = url.resolve(UserState.target.api, admin_data_endpoint);
    
    var pmNano = new PM_Nano(server_url, constsConfig.pm_default_data_bucket_name.valueOf(), authHeaders);
    var repository = pmNano.GetNanoRepository();
    
    var appDocID = PM_API.DeriveAppDocumentID_FromName(_app_name).versioned.valueOf();
    
    var _app_role_name = appDocID; // same as the app document.
    var _app_document;
    var _did_change = false;

    return ValidateAppExists()
    .then(EnsureRolesExist)
    .then(EnsureUsersExist)
    .then(AdjustAppUserAssignment)
    .then(AdjustAppRoleAssignment)
    .then(CommitIfAnyChanges)
    .then(function () {
        console.log("OK"); 
    });
    
    function ValidateAppExists() {
        return repository.findByIdAsync(appDocID)
        .catch(function (status) {
            logger.error("App not found in server datastore:", _app_name);
            return Promise.reject(status);
        })
        .then(function (document) {
            _app_document = document;
        });
    }
    
    function EnsureRolesExist() {
        if (_add_role_names.length > 0) {
            return PM_API.EnsureRolesExistAndContainSelfChannel(repository, _add_role_names);
        }
    }
    
    function EnsureUsersExist() {
        
        return Promise
        .map(
              arrayUnion(_add_user_names, _remove_user_names)
            , ProcessUser_check
            , {concurrency: 3}
        );
        
        function ProcessUser_check(userName) {
            var finalName = constsConfig.sanitize_username_filter(userName);
            var userDocID = "_user/" + finalName;
            
            return repository.findByIdAsync(userDocID)
            .catch(function (status) {
                logger.warn("User not found, issueing request to entitlement-service to initialize:", userName);
                
                return PM_API.InitUserViaEntitlementService(userName)
                .catch(function () {
                   logger.warn("User does not exist in datastore:", userName); 
                });
            });
            
        }
    }
    
    function CommitIfAnyChanges() {
        if (_did_change) {
            return repository.saveOverAsync(_app_document);
        }
    }
    
    function AdjustAppUserAssignment() {
        
        var addList = _add_user_names.map(function (userName) {
            return constsConfig.sanitize_username_filter(userName)
        });
        var removeList = _remove_user_names.map(function (userName) {
            return constsConfig.sanitize_username_filter(userName)
        });
        
        return Promise.map(
              addList
            , AddAppToUser
            , {concurrency: 3}
        )
        .then(function () {
            return Promise.map(
                  removeList
                , RemoveAppFromUser
                , {concurrency: 3}
            )
        })
        
        function AddAppToUser(userName) {
            var userDocID = "_user/" + userName;
            
            return repository.RetryUntilNot409Async(
                  userDocID
                , function (document) {
                    if (!document.admin_roles) document.admin_roles = [];
    
                    document.admin_roles = arrayUnion(document.admin_roles.valueOf(), [_app_role_name.valueOf()]);
                    document._id = userDocID;
                    
                    return repository.saveAsync(document);
                }
            );

        }
        
        function RemoveAppFromUser(userName) {
            var userDocID = "_user/" + userName;
            
            return repository.RetryUntilNot409Async(
                  userDocID
                , function (document) {
                    if (!document.admin_roles) document.admin_roles = [];
    
                    document.admin_roles = arraySubtract(document.admin_roles.valueOf(), [_app_role_name.valueOf()]);
                    document._id = userDocID;
                    
                    return repository.saveAsync(document);
                }
            );

        }
        
    }
    
    function AdjustAppRoleAssignment() {
        
        if (_add_role_names.length > 0) {
            _did_change = _did_change || PM_API.EnsureDocumentIncludesChannels(_app_document, _add_role_names);
        }
        
        if (_remove_role_names.length > 0) {
            _did_change = _did_change || PM_API.RemoveChannelsFromDocument(_app_document, _remove_role_names);
        }
        
    }
    
    
    
}



// exports:
var c = {};

c.Execute = Execute;

module.exports = c;
