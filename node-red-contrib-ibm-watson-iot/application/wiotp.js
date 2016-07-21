/**
 * Copyright 2016 IBM Corp.
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

module.exports = function(RED) {
    "use strict";

    var IoTClient = require("ibmiotf");

    var connectionPool = (function() {
        var connections = {};
        return {
            getClient: function(node,config,isGateway,cleanSession,keepAlive,qos,callback) {
                var nodeId = node.id;
                var key = JSON.stringify(config);
                if (!connections[key]) {
                    connections[key] = {
                        users:{}
                    }
                    var client;
                    if (isGateway) {
                        client = new IoTClient.IotfGateway(config);
                    } else {
                        client = new IoTClient.IotfDevice(config);
                    }
                    client.log.setLevel('info');
                    client.setMaxListeners(0);
                    client.setKeepAliveInterval(parseInt(keepAlive));
                    client.setCleanSession(cleanSession);

                    client.on('error',function(err) {
                        RED.log.error("[wiot:connectionPool:getClient] "+err.toString());
                    });
                    client.on('connect',function(err) {
                        var users = connections[key].users;
                        for (var u in users) {
                            if (users.hasOwnProperty(u)) {
                                users[u].node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
                                users[u].callback(connections[key].client);
                            }
                        }
                    });
                    client.on('disconnect',function() {
                        if (connections.hasOwnProperty(key)) {
                            var users = connections[key].users;
                            for (var u in users) {
                                if (users.hasOwnProperty(u)) {
                                    users[u].node.status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
                                }
                            }
                        }
                    });
                    client.on('reconnect',function() {
                        if (connections.hasOwnProperty(key)) {
                            var users = connections[key].users;
                            for (var u in users) {
                                if (users.hasOwnProperty(u)) {
                                    users[u].node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
                                }
                            }
                        }
                    });

                    client.connect(parseInt(qos));
                    connections[key].client = client;
                }
                connections[key].users[nodeId] = {
                    node: node,
                    callback:callback
                }
                node.status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
                if (connections[key].client.isConnected) {
                    node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
                    callback(connections[key].client);
                }

                return connections[key].client;
            },
            returnClient: function(nodeId, config) {
                var key = JSON.stringify(config);
                var connection = connections[key];
                if (connection) {
                    var users = connections[key].users;
                    delete users[nodeId];
                    if (Object.keys(users).length === 0) {
                        try {
                            connections[key].client.disconnect();
                        } catch(err) {}
                        delete connections[key];
                    }
                }
            },
            destroyClient: function(config) {
                var key = JSON.stringify(config);
                if (connections[key]) {
                    try {
                        connections[key].client.disconnect();
                    } catch(err) {}
                    delete connections[key];
                }
            }
        }
    })();

    function IotDeviceNode(n) {
        RED.nodes.createNode(this,n);
        this.name = n.name;
        this.config = {};
        this.config.org = n.org;
        this.config.id = n.devId;
        this.config.type = n.devType;
        this.config['auth-token'] = this.credentials.authToken;
        this.config['auth-method'] = 'token';
        this.valid = (this.config.org &&
        this.config.type &&
        this.config.id &&
        this.config['auth-token']);
        this.config.keepalive = n.keepalive;
        this.config.cleansession = n.cleansession;

        var node = this;
        this.on('close', function() {
            connectionPool.destroyClient(node.config);
        })

        if (typeof this.config.keepalive === 'undefined'){
            this.config.keepalive = 60;
        } else {
            if (typeof this.config.keepalive === 'string') {
              this.config.keepalive = Number(this.config.keepalive);
            }
        }

        if (typeof this.config.cleansession === 'undefined') {
            this.config.cleansession = true;
        }

    }

    RED.nodes.registerType("wiotp-credentials",IotDeviceNode, {
        credentials: {
            authToken: {type:"password"}
        }
    });


    function parsePayload(payload) {
        try {
            return JSON.parse(payload);
        } catch(err) {
            return payload;
        }
    }

    function IotAppInNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.command = n.command;
        this.qos = parseInt(n.qos) || 0;
        var deviceNode = RED.nodes.getNode(n.deviceKey);
        if (!deviceNode || !deviceNode.valid) {
            return this.error('missing IoT Device credentials');
        }
        this.keepalive = parseInt(deviceNode.config.keepalive) || 60;
        this.cleansession = deviceNode.config.cleansession;

        var isGateway = (n.authType === 'g');
        if (isGateway) {
            if (n.commandType === 'g') {
                this.deviceType = deviceNode.config.type;
                this.deviceId = deviceNode.config.id;
            } else {
                this.deviceType = n.deviceType;
                this.deviceId = n.deviceId;
            }
        } else {
            this.deviceType = "+";
            this.deviceId = "+";
        }
        this.client = connectionPool.getClient(this,deviceNode.config,isGateway,this.cleansession,this.keepalive,this.qos,function(client){
            if (isGateway) {
                client.subscribeToDeviceCommand(node.deviceType,node.deviceId,node.command,'+',node.qos);
            }
        });
        var handleMessage = function(deviceType,deviceId,commandName,format,payload,topic) {
            if (
                (node.deviceType === '+' || node.deviceType === deviceType) &&
                (node.deviceId === '+' || node.deviceId === deviceId) &&
                (node.command === '+' || node.command === commandName)
            ) {
                var msg = {
                    topic: topic,
                    payload: format === 'json'?parsePayload(payload):payload.toString(),
                    command: commandName,
                    format: format
                };
                if (isGateway) {
                    msg.deviceType = deviceType;
                    msg.deviceId = deviceId;
                }
                node.send(msg);
            }
        }
        if (isGateway) {
            this.onCommand = function(deviceType,deviceId,commandName,format,payload,topic) {
                handleMessage(deviceType,deviceId,commandName,format,payload,topic);
            }
        } else {
            this.onCommand = function(commandName,format,payload,topic) {
                handleMessage("","",commandName,format,payload,topic);
            }
        }
        this.client.on('command',node.onCommand);

        this.on('close', function() {
            if (node.client) {
                if (isGateway) {
                    node.client.unsubscribeToDeviceCommand(node.deviceType,node.deviceId,node.command,'+');
                }
                node.client.removeListener('command',node.onCommand);
                connectionPool.returnClient(node.id,deviceNode.config);
            }
        });
    }
    RED.nodes.registerType("wiotp in", IotAppInNode);

    function IotAppOutNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        var isGateway = (n.authType === 'g');
        var isQuickstart = (n.qs === 'true');

        this.deviceType = n.deviceType;
        this.deviceId = n.deviceId;
        this.format = n.format || "json";
        this.event = n.event;

        if (!isQuickstart) {
            var deviceNode = RED.nodes.getNode(n.deviceKey);
            if (!deviceNode || !deviceNode.valid) {
                return this.error('missing IoT Device credentials');
            }
            this.credentials = deviceNode.config;
            this.qos = parseInt(n.qos) || 0;
            this.keepalive = parseInt(deviceNode.config.keepalive) || 60;
            this.cleansession = deviceNode.config.cleansession;
        } else {
            this.credentials = {
                org: "quickstart",
                type: "node-red-wiotp",
                id: n.qsDeviceId || n.id
            }
            node.log("Connecting to Quickstart service as device "+this.credentials.type+"/"+this.credentials.id);
            this.qos = 0;
            this.keepalive = 60;
            this.cleansession = true;
        }
        this.client = connectionPool.getClient(this,this.credentials,isGateway,this.cleansession,this.keepalive,this.qos,function(client){});
        this.on('input',function(msg) {
            var event = node.event || msg.event || "event";
            var format = node.format || msg.format || "json";
            var qos = 0;
            if (msg.qos) {
                msg.qos = parseInt(msg.qos);
                if ((msg.qos !== 0) && (msg.qos !== 1) && (msg.qos !== 2)) {
                     msg.qos = null;
                }
            }
            qos = Number(node.qos || msg.qos || qos);
            if (isQuickstart || qos < 0 || qos > 2 ) {
                qos = 0;
            }
            var data = msg.payload;
            if (format !== 'json') {
                // For all non-json formats, toString the data before passing on
                if (!Buffer.isBuffer(data)) {
                    if (typeof data === "object") {
                        data = JSON.stringify(data);
                    } else if (typeof data !== "string") {
                        data = "" + data;
                    }
                }
            } else {
                if (Buffer.isBuffer(data)) {
                    data = JSON.stringify({d:{value:data.toString()}});
                } else {
                    if (typeof data === "object") {
                        if (!data.hasOwnProperty('d')) {
                            data = JSON.stringify({d:data});
                        } else {
                            data = JSON.stringify(data);
                        }
                    } else if (typeof data === "string") {
                        try {
                            var obj = JSON.parse(data);
                            if (typeof obj === 'object') {
                                if (Array.isArray(obj)) {
                                    data = JSON.stringify({d:{value:obj}});
                                } else if (!obj.hasOwnProperty('d')) {
                                    data = JSON.stringify({d:obj});
                                } else {
                                    // data is already a valid event object
                                }
                            } else {
                                data = JSON.stringify({d:{value:obj}});
                            }
                        } catch(err) {
                            // payload is not JSON, wrap it as a valid event object
                            data = JSON.stringify({d:{value:data}});
                        }
                    } else {
                        data = JSON.stringify({d:{value:data}});
                    }
                }
            }
            try {
                if (isGateway) {
                    var deviceType = node.deviceType || msg.deviceType || node.credentials.type;
                    var deviceId = node.deviceId || msg.deviceId || node.credentials.id;
                    node.client.publishEvent(deviceType,deviceId,event,format,data,qos);
                } else {
                    node.client.publish(event,format,data,qos);
                }
            } catch(err) {
                node.warn("Error sending message: "+err.toString(),msg);
            }
        });

        this.on('close', function() {
            if (node.client) {
                connectionPool.returnClient(node.id,node.credentials);
            }
        });
    }
    RED.nodes.registerType("wiotp out", IotAppOutNode);


};
