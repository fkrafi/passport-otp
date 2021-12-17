const Strategy = require('passport-strategy');
const util = require('util');
const { customAlphabet } = require('nanoid');
const assert = require('assert');
const { has, extend } = require('lodash');
const { numbers } = require('nanoid-dictionary');
const Storage = require('./storage');
const { v4: uuidv4 } = require('uuid');

function OTPStrategy(options, verify) {
  this.name = 'otp';

  this.options = options ? util._extend(options) : {};

  assert(has(this.options, ['sendOTP']));

  assert(has(this.options, 'redis') || has(this.options, 'mongodb'));
  this._storage = Storage(options.redis);

  this._verify = verify;

  var otpSize = this.options.otpSize || 6;
  var nanoid = customAlphabet(numbers, otpSize);
  if (this.options.otpContains) {
    nanoid = customAlphabet(this.options.otpContains, otpSize);
  }
  this._nanoid = nanoid;

  Strategy.call(this);
}

util.inherits(OTPStrategy, Strategy);

function getKey(username, otpId) {
  return `${username}_${otpId}`;
}

function getInvalidOTPError() {
  const e = new Error();
  e.status = 400;
  e.message = 'Invallid otp';
  return e;
}

OTPStrategy.prototype.getParam = function (req, field, defaultField) {
  if (req.method === 'POST') {
    return req.body[field || defaultField];
  }
  return req.query[field || defaultField];
};

OTPStrategy.prototype.authenticate = function (req, options) {
  this.options = extend(this.options, options);

  const username = this.getParam(req, this.options.usernameField, 'username');
  const otp = this.getParam(req, this.options.otpField, 'otp');
  const otpId = this.getParam(req, this.options.otpField, 'otpId');

  if (username && otp && otpId) {
    this.verifyOTP(username, otp, otpId);
  } else if (username) {
    this.startOTP(username);
  } else {
    return this.error('Could not authenticate! Please specify a username');
  }
};

OTPStrategy.prototype.startOTP = async function (username) {
  const that = this;
  const otp = this._nanoid();
  const otpId = uuidv4();
  this._storage
    .store(getKey(username, otpId), otp, this.options.tokenLifeTime || 15)
    .then(function () {
      that.options
        .sendOTP(username, otp)
        .then(function () {
          that.success({ otpId, username });
        })
        .catch(function (err) {
          that.error(err);
        });
    })
    .catch(function (err) {
      that.error(err);
    });
};

OTPStrategy.prototype.isValidOTP = function (record, otp) {
  return record === otp;
};

OTPStrategy.prototype.verifyOTP = function (username, otp, otpId) {
  var that = this;
  var key = getKey(username, otpId);
  this._storage
    .get(key)
    .then(function (record) {
      that._storage.del(key);
      const valid = that.isValidOTP(record, otp);
      if (valid) {
        function verified(err, user, info) {
          if (err) {
            return that.error(err);
          }
          if (!user) {
            return that.fail(info);
          }
          that.success(user, info);
        }

        try {
          that._verify(username, verified);
        } catch (ex) {
          return that.error(ex);
        }
      } else {
        that.error(getInvalidOTPError());
      }
    })
    .catch(function () {
      return that.error(getInvalidOTPError());
    });
};

module.exports = OTPStrategy;
