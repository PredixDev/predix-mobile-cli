#!/usr/bin/env node

'use strict';

var Logging = require("./lib/logging.js");
var logger = Logging.general.valueOf();
var program = require('commander');
var UserState = require("./lib/UserState.js");
var path = require("path");
var fs = require("fs");
var stripJsonComments = require('strip-json-comments');
var constsConfig = require("./config.js");
var Promise = require('bluebird'); Promise.longStackTraces();
var PM_API = new (require("./lib/pm-api/PM-API.js"))();
var AdjustAppPermissionsCommand = require("./lib/pm-commands/AdjustAppPermissionsCommand.js");

// parse input:
var _app_name;

program
    .usage('<app-name@app-version>, or <path to app.json>, or <path to folder containing app.json>')
    .option('-u, --user [username]', 'Grant `user` access to <app-name>.  Can be repeated to specify multiple users.', function (val, memo) { memo.push(val); return memo; }, [])
    .option('-r, --role [rolename]', 'Add <app-name> to specified role.  Roles that do not exist are created.  Can be repeated to specify multiple roles.', function (val, memo) { memo.push(val); return memo; }, [])
    .option('--debug', 'Set logging level to debug (more traces than "verbose")')
    .option('--verbose', 'Set logging level to verbose.')
    .parse(process.argv);

var _app_file;

var _default_manifest_file_name = constsConfig.default_app_manifest_file_name.valueOf();
var appFilePath = program.args[0];

if (!appFilePath) appFilePath = "";
_app_file = PM_API.TryResolveToPath(process.cwd(), appFilePath, _default_manifest_file_name);

var _app_name;
var _app_version;

if (_app_file) { // read file if available:
    var _app_document = PM_API.SimpleReadAppDocument(_app_file);
    
    _app_name = _app_document.name.valueOf();
    _app_version = _app_document.version.valueOf();
        
} else if (constsConfig.app_document_composite_id_validator(appFilePath)) { // try for name@version
    (function () {
        var list = appFilePath.split("@");
        _app_name = list[0].valueOf();
        _app_version = list[1].valueOf();
    })();
    
} else {
    logger.error("No application descriptor could be detected.  Specify a path to an app.json file, a folder containing app.json, or `cd` to the folder which contains app.json, and execute `define` again.");
    return;
}


if (
       (!program.role || (program.role.length === 0))
    && (!program.user || (program.user.length === 0))
) {
    logger.error("No user names or role names specified.  Try adding at least one `--user <username>` or `--role <rolename>` parameter.");
    return;
}

if (!UserState.target.api) { logger.error("API target not specified.  See 'pm api <api>' command."); return; }

var _add_role_names = []; // program.role || [];
var _add_user_names = []; // program.user || [];

var _remove_role_names = program.role || [];
var _remove_user_names = program.user || [];


// execute import:
AdjustAppPermissionsCommand.Execute({
      _app_name: (_app_name + "@" + _app_version)
    , _add_role_names: _add_role_names
    , _add_user_names: _add_user_names
    , _remove_role_names: _remove_role_names
    , _remove_user_names: _remove_user_names
});

