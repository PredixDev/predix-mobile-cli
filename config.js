'use strict';

var config = {};

// Default data bucket name:
config.pm_default_data_bucket_name = "pm";

// Filter for usernames at the command line, to final usernames found in the datastore:
config.sanitize_username_filter = function (input) {
	return input.replace(/[@#\.]/g, "_");
};

config.sanitize_app_name_filter = function (input) {
	return input.replace(/[@#\.]/g, "_");
};

config.sanitize_role_name_filter = function (input) {
	return input.replace(/[@#\.]/g, "_");
};

config.app_document_composite_id_validator = function (input) {
	 return /^[^@#\.]+(@([0-9]+\.?)*[0-9])?$/.test(input); // {name}(@{version})?
};

// The base path of a target PM server.  e.g. https://host-name/pg
config.server_base_path = "/pg";

// The path to the server configuration endpoint.
config.server_cli_server_config_path = config.server_base_path + "/api/info";

// The pattern to verify a specific user, under the session base URL returned by the server info query:
config.server_cli_session_verify_user_pattern = "/users?user_id={user_id}";

// Path to the /login endpoint of a target UAA server:
config.uaa_login_endpoint = "/login";

// Path to the oauth token endpoint of a target UAA server:
config.uaa_oauth_token_endpoint = "/oauth/token";

// Path to the oauth token validation endpoint, used for retrieving information about a given token:
config.uaa_oauth_check_token_endpoint = "/check_token";

// default webapp manifest file name:
config.default_webapp_manifest_file_name = "webapp.json";
 
 // default app manifest file name:
config.default_app_manifest_file_name = "app.json";
 
module.exports = config;