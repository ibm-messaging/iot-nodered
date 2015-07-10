IBM IoT App Out Node
========================
The IoT App Out Node is used to publish commands to specific device, of a given organization, identified by the device type and device id, on clicking the deploy button. 
It can also publish device events, on the behalf of a device. 

Usage
-------

In case of registered flow, the App Out node can be used to 

1. Send device commands and 
2. Send device events, on the behalf of a device.

In case of quickstart flow, the App Out node can be used to 

1. Send device events, on the behalf of a device.


----

MQTT Topic
----------

Command Publishing
^^^^^^^^^^^^^^^^^^
In case of a registered device, this node publishes commands to the following topic.

.. code:: text

	iot-2/type/<type id>/id/<device id>/cmd/<command type>/fmt/<format type>

	where
		<device type> denotes the device type, say for e.g. iotsample-arduino
		<device id> denotes the device id, say for e.g. 00aabbccdd01
		<command type> denotes the command to be pushed to the device, say for e.g. blink
		<format type> denotes the format, say for e.g. json


Internally, it invokes the

.. code:: javascript
	
		iotclient.publishDeviceCommand() method to publish the command


Event Publishing
^^^^^^^^^^^^^^^^
On the behalf of a registered device, it publishes the device events to the following topic

.. code:: text

	iot-2/type/<device type>/id/<device id>/evt/<event type>/fmt/<format type>

	where
		<device type> denotes the device type, say for e.g. iotsample-arduino
		<device id> denotes the device id, say for e.g. 00aabbccdd01
		<event type> denotes the event to be pushed to subscribing application, say for e.g. status
		<format type> denotes the format, say for e.g. json


Internally, it invokes the

.. code:: javascript
	
		iotclient.publishDeviceCommand() method to publish the command


In case of quickstart flow, the "device type" denotes the Node-RED version. 

The node creates the Topic string by reading the values from the textfield.

----

MQTT Client Id
---------------
As explained in the previous document, this Node is an application and so generates the MQTT Client Id in the following manner

.. code:: text
	

	a:<organization id>:<app Id>
	

	where
		<organization id> denotes the organization and in case of quickstart, it means "quickstart"
		<app Id> a random number

----

	
MQTT Userid and Password
------------------------
In case of quickstart flow, these are set to null. In case of registered flow, MQTT Userid corresponds to the API Key and the MQTT Password corresponds to the API Token. 

In case of Bluemix flow, these values are obtained from the VCAP credentials.

----

**Note**

Almost all the values provided in the textfield of the Node can be overriden. To override any value, use the following approach
.. code:: javascript
	
		msg.propertyToBeOverridden = <overridding value>

For e.g. 

.. code:: javascript
	
		msg.deviceId overrides the value of "Device Id"

		msg.deviceType overrides the value of "Device Type"

		msg.eventOrCommandType overrides the value of "Event Type" or "Command Type"

		msg.format overrides the value of "Format"

		msg.payload overrides the value of "Data"
