ibmiotapp
========================
This is a Node-RED node meant for connecting to both quickstart, as well as, registered flow on the IBM Watson IoT Foundation Connect.
This Node-RED node replaces the node-red-iotcloudshapeshift. This Node-RED node can be used within, as well as, outside the IBM Bluemix environment. 
  
In case its used within the IBM Bluemix environment, the node is smart enough to detect whether an IoT service is bound to this application and provides the respective drop-down options. 
In case no IoT service is bound to this application, the drop-down, for authentication, does not contain "Bluemix Service".  


Install
-------
Install from [npm](http://npmjs.org)
```
npm install node-red-contrib-scx-ibmiotapp
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


**Usage outside IBM Bluemix environment**

In case the out and in nodes need to run outside the IBM Bluemix environment, use the API Key dropdown option

1. On selecting the API Key, API Key and API Token options are made available
2. The API Key and Token can be shared across multiple nodes


Note
-------
For Device Id, this node ignores any character other than alphanumeric, the period symbol, hyphen and the underscore character.


Authors
-------
Amit M Mangalvedkar (@amitmangalvedka)   
Jeffrey Dare (@jeffdare)  


Copyright and license
----------------------
Copyright 2014, 2016 IBM Corp. under the [Apache 2.0 license](http://www.apache.org/licenses/LICENSE-2.0).

