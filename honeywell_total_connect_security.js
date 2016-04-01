var HoneywellDevice = require('zetta-honeywell-total-connect-driver');
var util = require('util');

var TIMEOUT = 2000;

var HoneywellTotalConnectSecurity = module.exports = function() {
  HoneywellDevice.call(this, arguments[0], arguments[1], arguments[2].LocationID);

  this.IsInACLoss = null;
  this.IsInLowBattery = null;

  this._lastUpdatedTimestampTicks = 621355968000000000;
  this._lastSequenceNumber = 0;
};
util.inherits(HoneywellTotalConnectSecurity, HoneywellDevice);

HoneywellTotalConnectSecurity.prototype.init = function(config) {

  var armingFields = [];
  if (1 === Number(this.PromptForUserCode)) {
    armingFields = [{name: 'UserCode', type: 'text'}];
  }
  
  config
    .name(this.DeviceName)
    .type('security')
    .when(null, {allow: ['update-state']})
    .when('disarmed', {allow: ['arm-stay', 'arm-away', 'update-state']})
    .when('armed-stay', {allow: ['disarm', 'update-state']})
    .when('armed-away', {allow: ['disarm', 'update-state']})
    .when('arming', {allow: ['update-state']})
    .when('disarming', {allow: ['update-state']})
    .map('arm-stay', this.armStay, armingFields)
    .map('arm-away', this.armAway, armingFields)
    .map('disarm', this.disarm, armingFields)
    .map('update-state', this.updateState, [{name: 'newState', type: 'text'}]);
    
  this._getPanelMetaDataAndFullStatusByDeviceID();
};

HoneywellTotalConnectSecurity.prototype.armStay = function() {
  var previousState = this.state;
  var resp = this._parseUserCode(arguments);
  var cb = resp[0];
  var userCode = resp[1];
  this.state = 'arming';
  cb();

  var self = this;
  this._soap._client.ArmSecuritySystem({
    SessionID: this._soap._sessionID,
    LocationID: this.LocationID,
    DeviceID: this.DeviceID,
    ArmType: 1,
    UserCode: userCode
  }, function(err, result, raw, soapHeader) {
    if (result.ArmSecuritySystemResult.ResultCode < 0) {
      self.state = previousState;
      cb();
    }
  });
  
}

HoneywellTotalConnectSecurity.prototype.armAway = function() {
  var previousState = this.state;
  var resp = this._parseUserCode(arguments);
  var cb = resp[0];
  var userCode = resp[1];
  this.state = 'arming';
  cb();

  var self = this;
  this._soap._client.ArmSecuritySystem({
    SessionID: this._soap._sessionID,
    LocationID: this.LocationID,
    DeviceID: this.DeviceID,
    ArmType: 0,
    UserCode: userCode
  }, function(err, result, raw, soapHeader) {
    if (result.ArmSecuritySystemResult.ResultCode < 0) {
      self.state = previousState;
      cb();
    }
  });
}

HoneywellTotalConnectSecurity.prototype.disarm = function() {
  var previousState = this.state;
  var resp = this._parseUserCode(arguments);
  var cb = resp[0];
  var userCode = resp[1];
  this.state = 'disarming';
  cb();
  
  var self = this;
  this._soap._client.DisarmSecuritySystem({
    SessionID: this._soap._sessionID,
    LocationID: this.LocationID,
    DeviceID: this.DeviceID,
    UserCode: userCode
  }, function(err, result, raw, soapHeader) {
    var resultCode = result.DisarmSecuritySystemResult.ResultCode;
    if (resultCode < 0) {
      self.state = previousState;
      cb();
    }
  });
}

HoneywellTotalConnectSecurity.prototype.updateState = function(newState, cb) {
  console.log('newState: ' + newState);
  this.state = newState;
  cb();
}

HoneywellTotalConnectSecurity.prototype._setArmingState = function(armingState) {
  var newState = null;
  switch (armingState) {
  case 10200:
    newState = 'disarmed';
    break;
  case 10201:
    newState = 'armed-away';
    break;
  case 10203:
    newState = 'armed-stay';
    break;
  case 10307:
    newState = 'arming'
    break;
  case 10308:
    newState = 'disarming'
    break;
  }
  
  if (newState === this.state) {
    return;
  } else {
    this.call('update-state', newState);
  }
}

HoneywellTotalConnectSecurity.prototype._getPanelMetaDataAndFullStatusByDeviceID = function() {
  this._soap._getPanelMetaDataAndFullStatusByDeviceID(this.DeviceID,
    this._lastUpdatedTimestampTicks,
    this._lastSequenceNumber,
    this._getPanelMetaDataAndFullStatusByDeviceIDCallback.bind(this));

  this._lastUpdatedTimestampTicks = this._soap._ticks();
}

HoneywellTotalConnectSecurity.prototype._getPanelMetaDataAndFullStatusByDeviceIDCallback = function(err, result, raw, soapHeader) {
  if (err) {
    return;
  }
  
  switch (result.GetPanelMetaDataAndFullStatusByDeviceIDResult.ResultCode) {
  case 0:
    var attributes = result.GetPanelMetaDataAndFullStatusByDeviceIDResult.PanelMetadataAndStatus.attributes;
    this._lastSequenceNumber = attributes.ConfigurationSequenceNumber;
    this.IsInACLoss = attributes.IsInACLoss;
    this.IsInLowBattery = attributes.IsInLowBattery;
    var armingState = result.GetPanelMetaDataAndFullStatusByDeviceIDResult.PanelMetadataAndStatus.Partitions.PartitionInfo[0].ArmingState;
    this._setArmingState(armingState);
    setTimeout(this._getPanelFullStatusByDeviceID.bind(this), TIMEOUT);
    break;
  default:
    break;
  }
}

HoneywellTotalConnectSecurity.prototype._getPanelFullStatusByDeviceID = function() {
  this._soap._getPanelFullStatusByDeviceID(this.DeviceID,
    this._lastUpdatedTimestampTicks,
    this._lastSequenceNumber,
    this._getPanelFullStatusByDeviceIDCallback.bind(this));

  this._lastUpdatedTimestampTicks = this._soap._ticks();
}

HoneywellTotalConnectSecurity.prototype._getPanelFullStatusByDeviceIDCallback = function(err, result, raw, soapHeader) {
  if (err) {
    return;
  }
  switch (result.GetPanelFullStatusByDeviceIDResult.ResultCode) {
  case 0:
    var attributes = result.GetPanelFullStatusByDeviceIDResult.PanelStatus.attributes;
    this._lastSequenceNumber = attributes.ConfigurationSequenceNumber;
    this.IsInACLoss = attributes.IsInACLoss;
    this.IsInLowBattery = attributes.IsInLowBattery;
    var armingState = result.GetPanelFullStatusByDeviceIDResult.PanelStatus.Partitions.PartitionInfo[0].ArmingState;
    this._setArmingState(armingState);
    setTimeout(this._getPanelFullStatusByDeviceID.bind(this), TIMEOUT);
    break;
  case 4002:
    this._getPanelMetaDataAndFullStatusByDeviceID();
    break;
  default:
    break;
  }
}

HoneywellTotalConnectSecurity.prototype._parseUserCode = function(args) {
  var userCode = -1;
  var cb = null;
  if (typeof args[0] === 'function') {
    cb = args[0];
  } else {
    userCode = Number(args[0]);
    cb = args[1];
  }
  return [cb, userCode];
}