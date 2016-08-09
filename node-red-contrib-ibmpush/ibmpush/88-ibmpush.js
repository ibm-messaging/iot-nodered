/**
 * Copyright 2014, 2016 IBM Corp.
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

var request = require('request');

var isBluemix = process.env.VCAP_SERVICES ? true:false;
var isBound = false;

//creds
var applicationUrl = "";
var applicationSecret = "";

if(isBluemix) {
	var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
	if(vcapServices.imfpush) {
		isBound = true;
		applicationUrl = vcapServices.imfpush[0].credentials.url;
		applicationSecret = vcapServices.imfpush[0].credentials.appSecret;
	}
}

//
// HTTP endpoints that will be accessed from the HTML file
//
RED.httpAdmin.get('/ibmpush/vcap', function(req,res) {
    res.json({
    	isBluemix : isBluemix,
    	isBound : isBound
    });
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
    res.sendStatus(200);
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
    res.sendStatus(200);
});


function IBMPushNode(n) {

	RED.nodes.createNode(this, n);
	var vcapApplication = {};
	// read the credential(appSecret)
	var credentials = RED.nodes.getCredentials(n.id);	

	if (isBound) {
		this.log("In Bluemix Environment & the IBM Push Notification service is bound");
	} else if(isBluemix) {
		this.log("In Bluemix Environment & the IBM Push Notification service is NOT bound");
		if (n.ApplicationID == "" || credentials.password == "") {
			this
					.error("The Push Notification service is not bound. "
							+ "Input Bluemix Application related properties - ID and Secret.");
			return null;
		}
		applicationUrl = "http://imfpush.ng.bluemix.net/imfpush/v1/apps/"+n.ApplicationID;
		applicationSecret = credentials.password;
	} else {
		this.log("In Local Environment");
		if (n.ApplicationID == "" || credentials.password == "") {
			this
					.error("The application is not in Bluemix Environment. "
							+ "Input Bluemix Application related properties - ID and Secret.");
			return null;
		}
		applicationUrl = "http://imfpush.ng.bluemix.net/imfpush/v1/apps/"+n.ApplicationID;
		applicationSecret = credentials.password;
	}

	this.log("Connecting to Push service with application URL : "
			+ applicationUrl );

	// get the identifiers for tags/deviceids
	this.notificationType = n.notification;
	this.identifiers = n.identifiers;

	//get the mode
	this.mode = n.mode;

	this.on("input", function(msg) {

		var alert = msg.payload;
		alert = alert.toString();

		if (this.identifiers != null)
			ids = this.identifiers.split(',');

		//remove the whitespaces for each value.
		for(var i=0;i<ids.length;i++)
			ids[i] = ids[i].trim();

		var message = {
				message : {
					alert : alert
				},
				target : {}
		};

		//first pref to the mode sent from the message
		this.mode = msg.mode || this.mode;

		console.log("The mode is "+this.mode);

		switch (this.notificationType) {
			case "broadcast":
				invokePush(this.mode,message,this);
				break;

			case "tags":
				
				message.target = {
					"tagNames": ids
				}
				invokePush('SANDBOX',message,this);
				break;

			case "deviceid":
				message.target = {
					"deviceIds": ids
				}
				invokePush('SANDBOX',message,this);
				break;

			case "android":
				message.target = {
					"platforms":["G"]
				}
				invokePush('SANDBOX',message,this);
				break;

			case "ios":
				message.target = {
					"platforms":["A"]
				}
				invokePush('SANDBOX',message,this);

				break;

			default:
				console.log("Invalid option. Please retry");
				return null;
		}

	});
}

RED.nodes.registerType("ibmpush", IBMPushNode);

//util function for Mobile Push ReST calls

function invokePush (appMode, message, node) {
	var options = {
	  url: applicationUrl+'/messages',
	  headers: {
	    'appSecret': applicationSecret,
	    'Application-Mode': appMode
	  },
	  method : 'POST',
	  json : true,
	  body : message
	};
	 
	function callback(error, response, body) {
	  if (!error && response.statusCode == 202) {
	    node.status({fill:"blue",shape:"dot",text:"Sent"});
	    node.status({});
	    
	  } else {
	  	node.error(response.statusCode +" : "+body.message);
	  	node.status({fill:"red",shape:"dot",text:"Error: "+response.statusCode+" : "+body.message});
	  }
	}
	 
	request(options, callback);
	node.status({fill:"blue",shape:"dot",text:"Sending"});
}
