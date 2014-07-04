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
var APPLICATION_PUB_TOPIC_REGEX = /^iot-2\/type\/[^#+\/]+\/id\/[^#+\/]+\/(?:evt|cmd)\/[^#+\/]+\/fmt\/[^#+\/]+$/g;

// Load the services VCAP from the CloudFoundry environment
var services = cfEnv.getCore().services || {};
var userServices = services['user-provided'];

// Store the IoT Cloud credentials, if any.
var credentials;
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

function setUpNode(node, nodeCfg){
    // Create a random appId
    var appId = util.guid();
    var clientId;

    // Set the default connection configuration and get the topic from the node configuration
    node.brokerHost = "quickstart.messaging.internetofthings.ibmcloud.com"; // Production
    node.brokerPort = "1883";
    node.organization = "quickstart";
    node.topic = nodeCfg.topic || "";

    // If credentials were found in the VCAP we ignore the defaults and connect to the broker using the configuation sepcified
    if(credentials){
        console.log("Using credentials:");
        console.log(credentials);
        clientId = "a:" + credentials.organization + ":" + appId;
        var username = credentials.organization + ":" + credentials.apiKey;
        var broker = credentials.organization + ".messaging.internetofthings.ibmcloud.com"; // Production
        node.client = connectionPool.get(broker, credentials.endpoint_port, clientId, username, credentials.apiToken);
    }
    else {
        clientId = "a:" + node.organization + ":" + appId;
        node.client = connectionPool.get(node.brokerHost, node.brokerPort, clientId, null, null);
    }

    node.client.connect();

    node.on("close", function() {
        if (node.client) {
            node.client.disconnect();
        }
    });
}

function IotAppInNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n);

    var that = this;
    if(this.topic){
        this.client.subscribe(this.topic, 0, function(topic, payload, qos, retain) {
            console.log("[App-In] Received MQTT message: " + payload);
            // if topic string ends in "json" attempt to parse. If fails, just pass through as string.
            // if topic string ends in anything other than "json" just pass through as string.
            var parsedPayload = "";
            if ( /json$/.test(topic) ){
                try{
                    parsedPayload = JSON.parse(payload);
                }catch(err){
                    parsedPayload = payload;
                }
            } else{
                parsedPayload = payload;
            }

            var msg = {"topic":topic, "payload":parsedPayload};
            console.log("[App-In] Forwarding message to output.");
            that.send(msg);
        });
    }  
}

RED.nodes.registerType("iot-app-in", IotAppInNode);


function IotAppOutNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n);

    this.on("input", function(msg) {
        console.log("[App-Out] Message arrived at input.");
        if (msg !== null) {
            msg.topic = this.topic || msg.topic;
            if (msg.topic && APPLICATION_PUB_TOPIC_REGEX.test(msg.topic)){
                console.log("[App-Out] Trying to publish MQTT message on topic: " + msg.topic);
                this.client.publish(msg);
            }            
         }
    });
}

RED.nodes.registerType("iot-app-out", IotAppOutNode);   