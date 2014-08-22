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
var fs = require("fs");
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

RED.httpAdmin.get('/iotFoundation/credential', function(req,res) {
//	console.log("Credentials asked for in Reg....");	
	res.send("", credentials ? 200 : 403);
});

RED.httpAdmin.get('/iotFoundation/newcredential', function(req,res) {
	console.log("Credentials asked for in Reg....");
	if (credentials) {
		res.send(JSON.stringify({'service':'registered'}));
	} else {
		res.send(JSON.stringify({}));
	}
});

function setUpNode(node, nodeCfg, inOrOut){
    // Create a random appId
    var appId = util.guid();    
    node.topic = nodeCfg.topic || "";
    	
	node.macChecked = nodeCfg.macChecked;
	node.deviceTypeChecked = nodeCfg.deviceTypeChecked;
	node.eventChecked = nodeCfg.eventChecked;
	node.formatChecked = nodeCfg.formatChecked;

	node.inputType = nodeCfg.inputType;
	node.deviceType = ( node.deviceTypechecked ) ? '+' : nodeCfg.deviceType;
	node.apikey = null;
	node.apitoken = null;
	node.mac = ( node.macChecked ) ? '+' : nodeCfg.mac;
	node.format = ( node.formatChecked ) ? '+' : nodeCfg.format;
	node.service = nodeCfg.service;
	if(credentials) {
		node.apikey = credentials.apiKey;
		node.apitoken = credentials.apiToken;
		node.organization = node.apikey.split(':')[1];
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
			node.topic = "iot-2/type/" + node.deviceType +"/id/" + node.mac + "/" + node.inputType + "/" + node.eventCommandType +"/fmt/" + node.format;
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
		node.topic = "iot-2/type/" + node.deviceType +"/id/" + node.mac + "/" + node.inputType + "/" + node.eventCommandType +"/fmt/" + node.format;
	}
	else {
		console.log("CANT COME HERE AT ALL");
	}
	node.brokerHost = node.organization + ".messaging.internetofthings.ibmcloud.com";
	node.brokerPort = "1883";

	node.name = nodeCfg.name;
	
    
    console.log('	Organization: '	+ node.organization);
    console.log('	Client ID: '	+ node.clientId); 
    console.log('	Broker Host: '	+ node.brokerHost); 
    console.log('	Broker Port: '	+ node.brokerPort);    
    console.log('	Topic: ' 		+ node.topic); 
    console.log('	Type: ' 		+ node.inputType); 
    console.log('	MAC: ' 			+ node.mac); 
    console.log('	Name: ' 		+ node.name); 
    console.log('	Format: ' 		+ node.format); 
	console.log('	Event: '		+ node.eventCommandType);
	console.log('	Service: '		+ node.service);

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

		var payload = msg.payload || n.data;
		var topic = "iot-2/type/" + (msg.deviceType || n.deviceType) +"/id/" + (msg.id || n.mac) + "/" + n.inputType + "/" + (msg.eventCommandType || n.eventCommandType) +"/fmt/" + (msg.format || n.format);

        if (msg !== null) {
            console.log("[App-Out] Trying to publish MQTT message on topic: " + topic);
            this.client.publish(topic, payload);
        }
    });
}

RED.nodes.registerType("iotdualapp out", IotAppOutNode);   


function IotAppInNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "in");

    var that = this;
    if(this.topic){
		if(that.inputType == "evt" ) {
			this.client.subscribeToDeviceEvents(this.deviceType, this.mac, this.eventCommandType, this.format);

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

				var msg = {"topic":that.topic, "payload":parsedPayload};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		} else if (that.inputType == "devsts") {
		
			this.client.subscribeToDeviceStatus(that.deviceType, this.mac);

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

				var msg = {"topic":that.topic, "payload":parsedPayload};
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

				var msg = {"topic":that.topic, "payload":parsedPayload};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});

		} else if (that.inputType == "cmd") {

			this.client.subscribeToDeviceCommands(that.deviceType, that.mac, that.eventCommandType, that.format);

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

				var msg = {"topic":that.topic, "payload":parsedPayload};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		}
	}
}

RED.nodes.registerType("iotdualapp in", IotAppInNode);
