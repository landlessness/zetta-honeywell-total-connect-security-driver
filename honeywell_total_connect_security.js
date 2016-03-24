var HoneywellDevice = require('zetta-honeywell-total-connect-driver');
var util = require('util');

var TIMEOUT = 2000;
var FAST_TIMEOUT = 500;

var HoneywellTotalConnectSecurity = module.exports = function() {
  HoneywellDevice.call(this, arguments[0], arguments[1], arguments[2].LocationID);

  this.IsInACLoss = null;
  this.IsInLowBattery = null;

  this._lastUpdatedTimestampTicks = 621355968000000000;
  this._lastSequenceNumber = 0;
  this._suppressUpdates = false;
};
util.inherits(HoneywellTotalConnectSecurity, HoneywellDevice);

// TODO: check the actual status of the panel then set current state
HoneywellTotalConnectSecurity.prototype.init = function(config) {

  // GetPanelFullStatusByDeviceID
  // ArmingState: 10200 -> Disarmed
  // ArmingState: 10201 -> Armed Away
  // ArmingState: 10203 -> Armed Stay
  // ArmingState: 10307 -> Arming (Stay & Away)
  // ArmingState: 10308 -> Disarming
  
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
  console.log('_getPanelMetaDataAndFullStatusByDeviceID this._lastSequenceNumber: ' + this._lastSequenceNumber);
  this._soap._getPanelMetaDataAndFullStatusByDeviceID(this.DeviceID, this._lastUpdatedTimestampTicks, this._lastSequenceNumber, this._getPanelMetaDataAndFullStatusByDeviceIDCallback.bind(this));
  this._lastUpdatedTimestampTicks = this._soap._ticks();
}

HoneywellTotalConnectSecurity.prototype._getPanelMetaDataAndFullStatusByDeviceIDCallback = function(err, result, raw, soapHeader) {
  
  if (err) {
    console.log('err _getPanelMetaDataAndFullStatusByDeviceIDCallback');
    return;
  }
  
  switch (result.GetPanelMetaDataAndFullStatusByDeviceIDResult.ResultCode) {
  case 0:
    console.log('0: _getPanelMetaDataAndFullStatusByDeviceIDCallback: ' + util.inspect(result.GetPanelMetaDataAndFullStatusByDeviceIDResult.PanelMetadataAndStatus));

    var attributes = result.GetPanelMetaDataAndFullStatusByDeviceIDResult.PanelMetadataAndStatus.attributes;
    this._lastSequenceNumber = attributes.ConfigurationSequenceNumber;
    this.IsInACLoss = attributes.IsInACLoss;
    this.IsInLowBattery = attributes.IsInLowBattery;

    var armingState = result.GetPanelMetaDataAndFullStatusByDeviceIDResult.PanelMetadataAndStatus.Partitions.PartitionInfo[0].ArmingState;
    console.log('metadataAndFull armingState: ' + armingState);
    this._setArmingState(armingState);
    
    setTimeout(this._getPanelFullStatusByDeviceID.bind(this), TIMEOUT);
    
    break;
  default:
    console.log('default: _getPanelMetaDataAndFullStatusByDeviceIDCallback: ' + util.inspect(result));
    break;
  }
}

HoneywellTotalConnectSecurity.prototype._getPanelFullStatusByDeviceID = function() {
  console.log('_getPanelFullStatusByDeviceID this._lastSequenceNumber: ' + this._lastSequenceNumber);
  this._soap._getPanelFullStatusByDeviceID(this.DeviceID, this._lastUpdatedTimestampTicks, this._lastSequenceNumber, this._getPanelFullStatusByDeviceIDCallback.bind(this));
  this._lastUpdatedTimestampTicks = this._soap._ticks();
}

HoneywellTotalConnectSecurity.prototype._getPanelFullStatusByDeviceIDCallback = function(err, result, raw, soapHeader) {
  if (err) {
    console.log('err _getPanelFullStatusByDeviceIDCallback');
    return;
  }
  
  console.log('client.getStatusCallback: ' + util.inspect(result));
  switch (result.GetPanelFullStatusByDeviceIDResult.ResultCode) {
  case 0:
    var attributes = result.GetPanelFullStatusByDeviceIDResult.PanelStatus.attributes;
    this._lastSequenceNumber = attributes.ConfigurationSequenceNumber;
    this.IsInACLoss = attributes.IsInACLoss;
    this.IsInLowBattery = attributes.IsInLowBattery;
    
    var armingState = result.GetPanelFullStatusByDeviceIDResult.PanelStatus.Partitions.PartitionInfo[0].ArmingState;
    this._setArmingState(armingState);
    console.log('full armingState: ' + armingState);

    setTimeout(this._getPanelFullStatusByDeviceID.bind(this), TIMEOUT);
    break;
  case 4002:
    this._getPanelMetaDataAndFullStatusByDeviceID();
    break;
  default:
    console.log('_getPanelFullStatusByDeviceIDCallback: ' + util.inspect(result.GetPanelFullStatusByDeviceIDResult.PanelStatus));
    break;
  }
}

HoneywellTotalConnectSecurity.prototype.updateState = function(newState, cb) {
  if (this._suppressUpdates === true) {
    return;
  } else {
    this.state = newState;
    cb();
  }
}

HoneywellTotalConnectSecurity.prototype.armStay = function() {
  this._suppressUpdates = true;
  
  var cb = null;
  var userCode = null;

  if (typeof arguments[0] === 'function') {
    cb = arguments[0];
  } else {
    userCode = arguments[0]
    cb = arguments[1];
  }

  console.log('armStay');
  
  var self = this;

  var previousState = this.state;
  this.state = 'arming';
  cb();

  console.log('this._soap._sessionID: ' + this._soap._sessionID);
  console.log('this.LocationID: ' + this.LocationID);
  console.log('this.DeviceID: ' + this.DeviceID);
  
  if (Number(userCode) <= 0 ) {
    userCode = -1;
  }
  
  this._soap._client.ArmSecuritySystem({
    SessionID: this._soap._sessionID,
    LocationID: this.LocationID,
    DeviceID: this.DeviceID,
    ArmType: 1,
    UserCode: userCode
  }, function(err, result, raw, soapHeader) {
    // TODO: handle err
    console.log('armStay: ' + util.inspect(result));
    if (result.ArmSecuritySystemResult.ResultCode === 0) {
      self.state = 'armed-stay';
      cb();
      self._suppressUpdates = false;
    } else if (result.ArmSecuritySystemResult.ResultCode > 0) {
      self._checkSecurityPanelLastCommandState({previousState: previousState, nextState: 'armed-stay', callback: cb});
    } else {
      // log an err?
      self.state = previousState;
      cb();
      self._suppressUpdates = false;
      console.log('armAway: ERROR: result.ArmSecuritySystemResult.ResultCode: ' + result.ArmSecuritySystemResult.ResultCode);
    }
  });
  
}

HoneywellTotalConnectSecurity.prototype.armAway = function() {
  this._suppressUpdates = true;

  var cb = null;
  var userCode = null;

  if (typeof arguments[0] === 'function') {
    cb = arguments[0];
  } else {
    userCode = arguments[0]
    cb = arguments[1];
  }

  console.log('armAway');

  var self = this;

  var previousState = this.state;
  this.state = 'arming';
  cb();

  if (Number(userCode) <= 0 ) {
    userCode = -1;
  }
  
  this._soap._client.ArmSecuritySystem({
    SessionID: this._soap._sessionID,
    LocationID: this.LocationID,
    DeviceID: this.DeviceID,
    ArmType: 0,
    UserCode: userCode
  }, function(err, result, raw, soapHeader) {
    // TODO: handle err
    console.log('armAway: ' + util.inspect(result));
    if (result.ArmSecuritySystemResult.ResultCode === 0) {
      self.state = 'armed-away';
      cb();
      self._suppressUpdates = false;
    } else if (result.ArmSecuritySystemResult.ResultCode > 0) {
      self._checkSecurityPanelLastCommandState({previousState: previousState, nextState: 'armed-away', callback: cb});
    } else {
      // log an err?
      self.state = previousState;
      cb();
      self._suppressUpdates = false;
      console.log('armAway: ERROR: result.ArmSecuritySystemResult.ResultCode: ' + result.ArmSecuritySystemResult.ResultCode);
    }
  });
}

HoneywellTotalConnectSecurity.prototype.disarm = function() {

  console.log('_isValidSession (false): ' + this._isValidSession('1234'));
  console.log('_isValidSession (true): ' + this._isValidSession(this._soap._sessionID));

  this._suppressUpdates = true;

  var cb = null;
  var userCode = null;

  if (typeof arguments[0] === 'function') {
    cb = arguments[0];
  } else {
    userCode = arguments[0]
    cb = arguments[1];
  }

  console.log('disarm');
  
  var self = this;
  
  var previousState = this.state;
  this.state = 'disarming';
  cb();
  
  if (Number(userCode) <= 0 ) {
    userCode = -1;
  }
  
  this._soap._client.DisarmSecuritySystem({
    SessionID: this._soap._sessionID,
    LocationID: this.LocationID,
    DeviceID: this.DeviceID,
    UserCode: userCode
  }, function(err, result, raw, soapHeader) {
    var resultCode = result.DisarmSecuritySystemResult.ResultCode;
    if (resultCode === 0) {
      console.log('result.DisarmSecuritySystemResult: ' + result.DisarmSecuritySystemResult);
      self.state = 'disarmed';
      cb();
      self._suppressUpdates = false;
    } else if (resultCode > 0) {
      self._checkSecurityPanelLastCommandState({previousState: previousState, nextState: 'disarmed', callback: cb});
    } else {
      // log an err?
      self.state = previousState;
      cb();
      self._suppressUpdates = false;
      console.log('disarm: ERROR: result.DisarmSecuritySystemResult.ResultCode: ' + result.DisarmSecuritySystemResult.ResultCode);
    }
  });

}

HoneywellTotalConnectSecurity.prototype._checkSecurityPanelLastCommandState = function(arg) {
  console.log('CheckSecurityPanelLastCommandState');
  var self = this;
  this._soap._client.CheckSecurityPanelLastCommandState({
    SessionID: this._soap._sessionID,
    LocationID: this.LocationID,
    DeviceID: this.DeviceID,
    CommandCode: -1
  }, function(err, result, raw, soapHeader) {
    console.log('_checkSecurityPanelLastCommandState: ' + util.inspect(result));
    var resultCode = result.CheckSecurityPanelLastCommandStateResult.ResultCode;
    console.log('_checkSecurityPanelLastCommandState resultCode: ' + resultCode);
    if (resultCode == 0) {
      self.state = arg.nextState;
      arg.callback();
      self._suppressUpdates = false;
      // success
    } else if (resultCode < 0 ) {
      self.state = arg.previousState;
      arg.callback();
      self._suppressUpdates = false;
      console.log(result.CheckSecurityPanelLastCommandStateResult.ResultData);
    } else {
      // TODO: handle err state and setting Zetta state
      setTimeout(self._checkSecurityPanelLastCommandState.bind(self), FAST_TIMEOUT, arg);
    }
  });
}
