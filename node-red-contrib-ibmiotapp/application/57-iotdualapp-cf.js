/**
 * Copyright 2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var RED = require(process.env.NODE_RED_HOME + "/red/red");
var connectionPool = require(process.env.NODE_RED_HOME + "/nodes/core/io/lib/mqttConnectionPool");
var util = require("./lib/util.js");
var cfEnv = require("cf-env");
//var fs = require("fs");
var IoTAppClient = require("iotclient");

var APPLICATION_PUB_TOPIC_REGEX = /^iot-2\/(?:evt|cmd|mon)\/[^#+\/]+\/fmt\/[^#+\/]+$/;


// Load the services VCAP from the CloudFoundry environment
var services = cfEnv.getCore().services || {};
var userServices = services['user-provided'];

// Store the IoT Cloud credentials, if any.
var credentials = false;

if (userServices) {
    for(var i = 0, l = userServices.length; i < l; i++){
        var service = userServices[i];
        if(service.credentials){
            if(service.credentials.iotCredentialsIdentifier){
                credentials = service.credentials;
                break;
            }
        }
    }
}
/*
else {
	var data = fs.readFileSync("credentials.cfg"), fileContents;
	try {
		fileContents = JSON.parse(data);
		credentials = {};
		credentials.apiKey = fileContents.apiKey;
		credentials.apiToken = fileContents.apiToken;
	}
	catch (ex){
		console.log("credentials.cfg doesn't exist or is not well formed, reverting to quickstart mode");
		credentials = null;
	}
}
*/

RED.httpAdmin.get('/iotFoundation/credential', function(req,res) {
	console.log("Credentials asked for by In node....");	
	res.send("", credentials ? 200 : 403);
});


RED.httpAdmin.get('/iotFoundation/newcredential', function(req,res) {
	console.log("Credentials asked for by Out node....");
	if (credentials) {
		res.send(JSON.stringify({service:'registered', version: RED.version() }));
	} else {
		res.send(JSON.stringify({service:'quickstart', version: RED.version() }));
	}
});

function setUpNode(node, nodeCfg, inOrOut){
    // Create a random appId
    var appId = util.guid();    
	node.service = nodeCfg.service;
	node.topic = nodeCfg.topic || "";
    	
	node.macChecked = nodeCfg.macChecked;
	node.deviceTypeChecked = nodeCfg.deviceTypeChecked;
	node.eventChecked = nodeCfg.eventChecked;
	node.formatChecked = nodeCfg.formatChecked;

	node.inputType = nodeCfg.inputType;
	node.outputType = nodeCfg.outputType;

	if(node.service !== "quickstart") {
		node.deviceType = ( node.deviceTypeChecked ) ? '+' : nodeCfg.deviceType;
	} else {
		console.log("ITS A QUICKSTART FLOW");
		node.deviceType = "nodered-version" + RED.version();
	}

	node.apikey = null;
	node.apitoken = null;
	node.mac = ( node.macChecked ) ? '+' : nodeCfg.mac;
	node.format = ( node.formatChecked ) ? '+' : nodeCfg.format;

	if(credentials) {
		node.apikey = credentials.apiKey;
		node.apitoken = credentials.apiToken;
		node.organization = node.apikey.split(':')[1];
		console.log("Organization = " + node.organization);
		if(node.organization == null) {
			node.organization = node.apikey.split('-')[1];
			console.log("Organization parsed again and is " + node.organization);
		}
	} else {
		node.organization = "quickstart";
		node.apikey = null;
		node.apitoken = null;
	}
	node.eventCommandType = ( node.eventChecked ) ? '+' : nodeCfg.eventCommandType;

	if(inOrOut == "in") {
		console.log("InNode ");
		node.clientId = "a:" + node.organization + ":" + appId;

		if(node.inputType == "evt" || node.inputType == "cmd") {
			if(node.service !== "quickstart") {
				node.topic = "iot-2/type/" + node.deviceType +"/id/" + node.mac + "/" + node.inputType + "/" + node.eventCommandType +"/fmt/" + node.format;
			}else {
				node.topic = "iot-2/type/+/id/" + node.mac + "/" + node.inputType + "/" + node.eventCommandType +"/fmt/" + node.format;
			}
		} else if(node.inputType == "devsts") {
			node.topic = "iot-2/type/+/id/" + node.mac + "/mon";
		} else if(node.inputType == "apsts") {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		} else {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		}
	}
	else if(inOrOut == "out") {
		console.log("OutNode ");
		node.clientId = "a:" + node.organization + ":" + appId;
		node.topic = "iot-2/type/" + node.deviceType +"/id/" + node.mac + "/" + node.outputType + "/" + node.eventCommandType +"/fmt/" + node.format;
	}
	else {
		console.log("CANT COME HERE AT ALL");
	}
	node.brokerHost = node.organization + ".messaging.internetofthings.ibmcloud.com";
	node.brokerPort = "1883";

	node.name = nodeCfg.name;
	
    
    console.log('	Organization: '			+ node.organization);
    console.log('	Client ID: '			+ node.clientId); 
    console.log('	Broker Host: '			+ node.brokerHost); 
    console.log('	Broker Port: '			+ node.brokerPort);    
    console.log('	Topic: '				+ node.topic); 
    console.log('	InputType: '			+ node.inputType); 
    console.log('	OutputType: '			+ node.outputType); 
    console.log('	MAC: ' 					+ node.mac); 
    console.log('	Name: '					+ node.name); 
    console.log('	Format: ' 				+ node.format); 
	console.log('	Event/Command Type: '	+ node.eventCommandType);
	console.log('	DeviceType: '			+ node.deviceType);
	console.log('	Service: '				+ node.service);

    node.client = new IoTAppClient(appId, node.apikey, node.apitoken);
    node.client.connectBroker();

    node.on("close", function() {
        if (node.client) {
            node.client.disconnectBroker();
        }
    });
}


function IotAppOutNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "out");

	var that = this;

    this.on("input", function(msg) {
//		console.log("\n\n\nn.data = " + n.data + "\tmsg.payload = " + msg.payload + "\tmsg.deviceType = " + msg.deviceType + "\tn.deviceType" + n.deviceType);
		var payload = msg.payload || n.data;
		var deviceType = that.deviceType;
		if(that.service == "registered") {
			deviceType = msg.deviceType || n.deviceType;
		}
		var topic = "iot-2/type/" + deviceType +"/id/" + (msg.deviceId || n.mac) + "/" + n.outputType + "/" + (msg.eventOrCommandType || n.eventCommandType) +
			"/fmt/" + (msg.format || n.format);

        if (msg !== null && (n.service == "quickstart" || n.format == "json") ) {
			try {
				var parsedPayload = JSON.parse(payload);
				console.log("[App-Out] Trying to publish MQTT JSON message " + parsedPayload + " on topic: " + topic);
				this.client.publish(topic, payload);
			}
			catch (err) {
				console.log("Non JSON payload is not published" + err);
			}
		} else if(msg !== null) {
			if(typeof payload == "number") {
				payload = "" + payload + "";
			}
			console.log("[App-Out] Trying to publish MQTT message" + payload + " on topic: " + topic);
		    this.client.publish(topic, payload);
		}
    });
}

RED.nodes.registerType("ibmiot out", IotAppOutNode);   


function IotAppInNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "in");

    var that = this;
    if(this.topic){
		if(that.inputType == "evt" ) {

			if(n.service == "quickstart") {
				that.deviceType = "+";
			}

			this.client.subscribeToDeviceEvents(that.deviceType, this.mac, this.eventCommandType, this.format);

			this.client.on("deviceEvent", function(deviceType, deviceId, eventType, formatType, payload) {

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "eventType" : eventType, "format" : formatType};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		} else if (that.inputType == "devsts") {
		
			var deviceTypeSubscribed = this.deviceType;

			if(this.service == "quickstart") {
				deviceTypeSubscribed = "+";
			}

			this.client.subscribeToDeviceStatus(deviceTypeSubscribed, this.mac);

			this.client.on("deviceStatus", function(deviceType, deviceId, payload) {

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		} else if (that.inputType == "appsts") {

			this.client.subscribeToAppStatus(this.mac);

			this.client.on("appStatus", function(deviceId, payload) {

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload, "applicationId" : deviceId};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});

		} else if (that.inputType == "cmd") {

			this.client.subscribeToDeviceCommands(this.deviceType, this.mac, this.eventCommandType, this.format);

			this.client.on("deviceCommand", function(deviceType, deviceId, commandType, formatType, payload) {

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "commandType" : commandType, "format" : formatType};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		}
	}
}

RED.nodes.registerType("ibmiot in", IotAppInNode);