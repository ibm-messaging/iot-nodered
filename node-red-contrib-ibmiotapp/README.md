ibmiotapp
========================
This is a Node-RED node meant for connecting to both quickstart, as well as, registered flow on the IBM Internet of Things Foundation.
This Node-RED node replaces the node-red-iotcloudshapeshift.

Install
-------
Install from [npm](http://npmjs.org)
```
npm install node-red-contrib-ibmiotapp
```

Usage
-------

**IoT App In Node**

In case of registered flow, the App In node can be used to 

1. Receive device events, 
2. Receive device status, 
3. Receive device commands, on the behalf of a device, and 
4. Receive application status.

In case of quickstart flow, the App In node can be used to 

1. Receive device events, 
2. Receive device status and 
3. Receive application status.


**IoT App Out Node**

In case of registered flow, the App Out node can be used to 

1. Send device commands and 
2. Send device events, on the behalf of a device.

In case of quickstart flow, the App Out node can be used to 

1. Send device events, on the behalf of a device.
