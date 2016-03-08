node-red-contrib-ibm-watson-iot
===============================

A pair of Node-RED nodes for connecting to the IBM Watson Internet of Things Platform
as a Device or Gateway.

## Install

Run the following command in the user directory of your Node-RED install. This is
usually ``~/.node-red`.

```
npm install node-red-contrib-ibm-watson-iot
```

## Usage

### Input Node

The input node receive device commands from the IBM Watson Internet of Things Platform.

The node can connect as either a Device or Gateway:

  - **Device**: the node can be configured to either receive all commands for
      the Device, or just select a specific command type.
  - **Gateway**: the node can be configured to receive commands for all devices
      connected through the gateway, or to select a subset of them.

The message sent by this node will include the following properties:

   - `payload` - the body of the command. If the command was identified as json,
    this property will be a JavaScript object, otherwise it will be a string.
   - `topic` - the topic the command was received on
   - `command` - the command name
   - `format` - the format of the command
   - `deviceType` - (*gateway only*) the type of device the command is for
   - `deviceId` - (*gateway only*) the id of the device the command is for


### Output Node

Send device events to the IBM Watson Internet of Things Platform.

The node can connect as either a Device or Gateway, in registered mode or using
the Quickstart service.

When connecting using the Quickstart service, the connection will use a device
type of `node-red-ibmwiotp` and a randomly generated device id, which can be
configured in the node. The events from the node can then be viewed on the [Quickstart dashboard](https://quickstart.internetofthings.ibmcloud.com/).

The type of the event sent can be configured in the node or, if left blank, can
be set by the `msg.event` property.

The format of the event defaults to `json`, but can be set to another value or,
if left blank, can be set by the `msg.format` property.

The data for the event is taken from `msg.payload`. If `format` is set to `json`,
this node will attempt to encode the data appropriately:

  - If the data is an Object of the form: `{ d: { ... }}` it will be used as-is.
    Similarly if it is a string representation of such an object no further
    encoding will be done.
  - For any other type of object, for example a Number, it will be sent as `{"d":{"value":123}}`

If `format` is set to anything else, the data will be passed on as-is.

When connected as a Gateway, the type and id of the Device the event is being
sent on behalf of can be configured in the node or, if left blank, can be set by
the `msg.deviceType` and `msg.deviceId` properties. If these properties are not
provided, either in the node or the message, it will use the type and id of the
Gateway itself.
