/**
 * Copyright 2014, 2015 IBM Corp.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var RED = require(process.env.NODE_RED_HOME + "/red/red");

var ibmbluemix = require('ibmbluemix');
var ibmpush = require('ibmpush');

var isVCapEnv = process.env.VCAP_APPLICATION ? true:false;

//
// HTTP endpoints that will be accessed from the HTML file
//
RED.httpAdmin.get('/ibmpush/vcap', function(req,res) {
    res.send(isVCapEnv);
});

// REMINDER: routes are order dependent
RED.httpAdmin.get('/ibmpush/:id', function(req,res) {
    var credentials = RED.nodes.getCredentials(req.params.id);

    if (credentials) {
        res.send(JSON.stringify(
          {
              hasPassword: (credentials.password && credentials.password !== "")
          }
        ));
    } else {
        res.send(JSON.stringify({}));
    }
});

RED.httpAdmin.delete('/ibmpush/:id', function(req,res) {
    RED.nodes.deleteCredentials(req.params.id);
    res.send(200);
});

RED.httpAdmin.post('/ibmpush/:id', function(req,res) {
    var newCreds = req.body;
    var credentials = RED.nodes.getCredentials(req.params.id) || {};

    if (newCreds.password == "") {
        delete credentials.password;
    } else {
        credentials.password = newCreds.password || credentials.password;
    }

    RED.nodes.addCredentials(req.params.id, credentials);
    res.send(200);
});


function IBMPushNode(n) {

	RED.nodes.createNode(this, n);
	var vcapApplication = {};
	var appName = n.name || "ibmpushApp";

	// read the credential(appSecret)
	var credentials = RED.nodes.getCredentials(n.id);
	var applicationSecret = credentials.password;
	var config = {};

	if (isVCapEnv) {
		this.log("In Bluemix Environment");
		try {
			vcapApplication = JSON.parse(process.env.VCAP_APPLICATION);
		} catch (e) {
			  // syntax error
			this.error("There is no Mobile Application Security service bound to " +
					"this application. Please add the Mobile Application Security " +
					"and Push service to this application.");
			return null;
		}
		var vcap_app_id = vcapApplication.application_id;
		var vcap_app_route = vcapApplication.application_uris[0];
		if (vcap_app_id == "" || vcap_app_route == "") {
			this.error("There is no Mobile Application Security service bound to this " +
					"application. Please add the Mobile Application Security and " +
					"Push service to this application.");
			return null;
		}
		if (applicationSecret == "") {
			this.error("The Application Secret is empty.");
			return null;
		}
		config = {
			applicationId : vcap_app_id,
			applicationRoute : vcap_app_route,
			applicationSecret : applicationSecret,
			applicationName : appName
		};
	} else {
		this.log("In Local Environment");
		if (n.ApplicationID == "" || n.ApplicationRoute == ""
				|| applicationSecret == "") {
			this
					.error("The application is not in Bluemix Environment. "
							+ "Input Bluemix Application related properties - ID, route and Secret.");
			return null;
		}
		config = {
			applicationId : n.ApplicationID,
			applicationRoute : n.ApplicationRoute,
			applicationSecret : applicationSecret,
			applicationName : appName
		};
	}

	this.log("Connecting to Push service with application ID : "
			+ config.applicationId + " route : " + config.applicationRoute);

	ibmbluemix.initialize(config);
	var push = ibmpush.initializeService();

	// get the identifiers for tags/deviceids
	this.notificationType = n.notification;
	this.identifiers = n.identifiers;

	this.on("input", function(msg) {

		var alert = msg.payload;
		alert = alert.toString();
		var url = null;
		var ids = null;

		if (this.identifiers != null)
			ids = this.identifiers.split(',');

		if (msg.url != null) {
			url = msg.url;
		}

		var message = {
			alert : alert,
			url : url
		};

		switch (this.notificationType) {
		case "broadcast":
			push.sendBroadcastNotification(message).then(function(response) {
				console.log(response);
			}, function(err) {
				console.log(err);
			});
			break;

		case "tags":
			push.sendNotificationByTags(message, ids).then(function(response) {
				console.log(response);
			}, function(err) {
				console.log(err);
			});
			break;

		case "deviceid":
			push.sendNotificationByDeviceIds(message, ids).then(
					function(response) {
						console.log(response);
					}, function(err) {
						console.log(err);
					});
			break;

		case "consumerid":
			var conIds  = [];
			for(var i =0 ; i< ids.length ; i++ ){
				conIds[i] = {};
				conIds[i].consumerId = ids[i];
			}
			push.sendNotificationByConsumerId(message, conIds).then(
					function(response) {
						console.log(response);
					}, function(err) {
						console.log(err);
					});
			break;

		default:
			console.log("Invalid option. Please retry");
			return null;
		}

	});
}

RED.nodes.registerType("ibmpush", IBMPushNode);
