
'use strict';

var Promise = require('bluebird'); Promise.longStackTraces();
var HttpUtil = require("../http/HTTP-Util.js");
var RequestUtil = require('../http/RequestUtil.js');

var Logging = require('../logging.js');
var logger = Logging.general.valueOf();

var constConfig = require('../../config.js');

function UAAConfig(UserState) {
	
	this.ClearSession = function () {
		this.SetAccessToken(null);
		this.SetRefreshToken(null);
	};
	
	this.GetSessionHeaders = function () {
		return {
			"Authorization": this.AccessToken()
		};
	};
	
	this.AuthenticationEndpoint = function () {
		return UserState.uaa.uaaBaseURL;
	};
	this.SetAuthenticationEndpoint = function (uaaBaseURL) {
		UserState.uaa.uaaBaseURL = uaaBaseURL;
	};
	
	this.UaaEndpoint = function () {
		return UserState.uaa.uaaEndpoint;
	};
	this.SetUaaEndpoint = function (uaaEndpoint) {
		UserState.uaa.uaaEndpoint = uaaEndpoint;
	};
	
	this.UAAPrompts = function () {
		return UserState.uaa.prompts;
	};
	this.SetUAAPrompts = function (prompts) {
		UserState.uaa.prompts = prompts;
	};
	
	this.AccessTokenWithoutType = function () {
		var list = this.AccessToken().split(" ")
		list.shift(); // "bearer "
		return list.join(" ");
	};
	this.AccessToken = function () {
		return UserState.uaa.accessToken;
	};
	this.SetAccessToken = function (accessToken) {
		UserState.uaa.accessToken = accessToken;
	};
	
	this.RefreshToken = function () {
		return UserState.uaa.refreshToken;
	};
	this.SetRefreshToken = function (refreshToken) {
		UserState.uaa.refreshToken = refreshToken;
	};
	
	this.LastSessionCheckToken = function () {
		return UserState.uaa.checkToken;
	};
	this.SetLastSessionCheckToken = function (value) {
		UserState.uaa.checkToken = value;
	};
	
}

function UAA(config) {
	var uaa = this;
	this.config = config;
		
	function Authenticate(credentials) {
		var data = {
			"grant_type": "password",
			"scope": ""
		};
		for (var key in credentials) {
			data[key] = credentials[key];
		}
		
		return uaa.getAuthToken(data)
		.spread(null, function (response, body) {
			if (response.statusCode.valueOf() === 401) {
				response.error = "Credentials were rejected, please try again.";
				return Promise.reject([response, body]);
			}
		})
		.spread(function (response, body) {
			return uaa.CheckToken()
			.spread(null, function (response, body) {
				if (response.statusCode.valueOf() !== 200) {
					response.error = "Credentials were retrieved, but CheckToken endpoint returned an error.  The session may not be valid, or the user may not be properly configured.";
					return Promise.reject([response, body]);
				}
			})
		});

	}
	
	function RefreshAuthToken() {
		var data = {};
		data.refresh_token = uaa.config.RefreshToken();
		data.grant_type = "refresh_token";
		data.scope = "";
		 
		return uaa.getAuthToken(data)
		.then(function () {
			return uaa.config.AccessToken();
		});
	}
	
	function GetLoginPromptsAndSaveUAAServerURL() {
		
		var url = RequestUtil.ResolveURL(uaa.config.AuthenticationEndpoint(), constConfig.uaa_login_endpoint.valueOf());
		
		return HttpUtil.GetResource("GET", url, null, {json: true})
		.spread(function (response, body) {
			
			// prompts: {
			// 	username: ["text", "Email"],
			//	password: ["password", "Password"]
			// }
			if (!body.prompts || !body.links) {
				var msg = "UAA target did not return response in expected fromat for `/login`, unable to proceed";
				response.error = msg;
				logger.error(msg, "Response Detail:", "Response", Logging.SanitizeTrace(response), "; Body:", body);
				return Promise.reject([response, body]);
			}
			
			uaa.config.SetUAAPrompts(body.prompts.valueOf());
			
			if (!body.links.uaa) {
				uaa.config.SetUaaEndpoint(uaa.config.AuthenticationEndpoint())
			} else {
				uaa.config.SetUaaEndpoint(body.links.uaa)
			}
			
			return body.prompts;
		})
	}
	
	function ConstructAuthHeaders() {
		var headers = {
			"Authorization": "Basic " + (new Buffer("pm:").toString('base64')) 
		};
		return headers;
	}
	
	function getAuthToken(data) {
		
		var path = RequestUtil.ResolveURL(uaa.config.AuthenticationEndpoint(), constConfig.uaa_oauth_token_endpoint.valueOf());
		
		// request, err := uaa.gateway.NewRequest("POST", path, "Basic "+base64.StdEncoding.EncodeToString([]byte("cf:")), strings.NewReader(data.Encode())) 
		var headers = ConstructAuthHeaders();
		// 	AccessToken  string           `json:"access_token"`
		// 	TokenType    string           `json:"token_type"`
		// 	RefreshToken string           `json:"refresh_token"`
		// 	Error        uaaErrorResponse `json:"error"`
		
		return HttpUtil.GetResource("POST", path, headers, {form: data})
		.spread(null, function (response, body) {
			if (response.statusCode.valueOf() === 401) {
				response.error = "Authentication has expired.  Please re-authenticate to continue.\n\nUse `pm auth` or `pm login` to re-authenticate.";
				return Promise.reject([response, body]);
			}
		})
		.spread(function (response, body) {
			if (
					body.error
				&& (body.error.code !== "") 
				&& (body.error.code !== null) 
				&& (body.error.code !== void(0))
			) {
				response.error = body.error;
				return Promise.reject([response, body])
			}
			
			uaa.config.SetAccessToken(body.token_type.valueOf() + " " + body.access_token.valueOf());
			uaa.config.SetRefreshToken(body.refresh_token.valueOf());
		});
	}
	
	function CheckToken() {
		
		var access_token = uaa.config.AccessTokenWithoutType();
		
		var path = RequestUtil.ResolveURL(uaa.config.AuthenticationEndpoint(), constConfig.uaa_oauth_check_token_endpoint.valueOf());
		var headers = ConstructAuthHeaders();

		// {  
		//    "jti":"923fce6b-cdee-48c4-90f0-196bd67409ed",
		//    "sub":"f8b772d3-a70e-4fa5-82f3-7c5bcfa7bfcf",
		//    "scope":[  
		//       "openid"
		//    ],
		//    "client_id":"pm",
		//    "cid":"pm",
		//    "azp":"pm",
		//    "grant_type":"password",
		//    "user_id":"f8b772d3-a70e-4fa5-82f3-7c5bcfa7bfcf",
		//    "origin":"uaa",
		//    "user_name":"test@ge.com",
		//    "email":"test@ge.com",
		//    "rev_sig":"db7c7262",
		//    "iat":1447873912,
		//    "exp":1447917112,
		//    "iss":"https://cf4fefe7-0000-0000-0000-8528a871f586.predix-uaa-staging.grc-apps.svc.ice.ge.com/oauth/token",
		//    "zid":"cf4fefe7-0000-0000-0000-8528a871f586",
		//    "aud":[  
		//       "pm",
		//       "openid"
		//    ]
		// }
		
		return HttpUtil.GetResource("POST", path, headers, {form: {token: access_token.valueOf()}})
		.spread(function (response, body) {
			if (
					body.error
				&& (body.error.code !== "") 
				&& (body.error.code !== null) 
				&& (body.error.code !== void(0))
			) {
				response.error = body.error;
				return Promise.reject([response, body])
			}
			
			uaa.config.SetLastSessionCheckToken(body);
		});
	}
	
	// exports:
	this.GetLoginPromptsAndSaveUAAServerURL = GetLoginPromptsAndSaveUAAServerURL;
	this.Authenticate = Authenticate;
	this.RefreshAuthToken = RefreshAuthToken;
	this.getAuthToken = getAuthToken;
	this.CheckToken = CheckToken;
	
}

module.exports = {
	  UAA: UAA
	, UAAConfig: UAAConfig
};

