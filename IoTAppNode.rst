IBM IoT App Node
========================
This is a set of two complementary Nodes - 

1. IoT App In Node which is meant for subscribing to Watson IoT Platform, and
2. IoT App Out Node which is meant for publishing to Watson IoT Platform 

This set of Nodes is an IoT application which can communicate, bidirectionally, with Watson IoT Platform. It can be used in both Quickstart and Registered flows. Being an app, it can subscribe to device events, as well as publish commands for Watson IoT Platform registered devices. 

It can also act as a Proxy for devices. This IoT pattern is typically used in cases where the device is incapable of sending events or receiving commands. In such a case, the Node can also subscribe to device commands and publish device events. While subscribing to device commands, the device (for which this app is a proxy) should be a registered device.

This set of Nodes provides multiple authentication modes (provided as drop-down), namely 

1. Quickstart
2. Bluemix
3. API Authentication 

"Quickstart" mode, as the name implies, provides a Quickstart flow. This option is available even if the Node is running in a non-Bluemix environment, like say desktop or laptop or a server.

"Bluemix" mode is only available when the Node is running in Bluemix environment and the application has a bound (or added) IoT service. In case the Node is used in Bluemix environment, but the application (which makes use of this Node) does not have any bound (or added) IoT service, this Node will not display the Bluemix drop-down option. 

"API Key" option is available even if the Node is running in a non-Bluemix environment or if the application, although running in Bluemix, does not have any bound IoT service. This option makes it possible for an application to communicate with multiple organizations.


This set of Nodes depends upon the `iotclient library <https://www.npmjs.com/package/iotclient>`__, made available in npmjs, for performing the Watson IoT Platform connectivity.


----


Install
-------
Install from `npmjs <http://npmjs.org>`__

.. code:: javascript

	npm install node-red-contrib-scx-ibmiotapp


----



Usage outside IBM Bluemix environment
----------------------------------------
As explained previously, the Nodes can be used outside the Bluemix environment as well.

In case the out and in nodes need to run outside the IBM Bluemix environment, use the API Key dropdown option

1. On selecting the API Key, API Key and API Token options are made available
2. The API Key and Token can be shared across multiple nodes

----

Documentation
-------------
Adhering to the convention of providing in-line documentation, all the fields in the Nodes are well documented and their usage and features can be viewed by just clicking on the node and switching to the Info tab, in the workspace.

Apart from that, the below links provide more detailed information about whats going under the hood for both the nodes.

* `IBM IoT App In Node <https://github.com/ibm-messaging/iot-nodered/blob/master/IoTAppInNode.rst>`__
* `IBM IoT App Out Node <https://github.com/ibm-messaging/iot-nodered/blob/master/IoTAppOutNode.rst>`__

----

**Note**

For Device Id, this node ignores any character other than alphanumeric, the period symbol, hyphen and the underscore character.

