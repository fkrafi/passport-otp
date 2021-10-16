const Strategy = require('passport-strategy');
const util = require('util');
const { customAlphabet } = require('nanoid');
const assert = require('assert');
const { has, extend } = require('lodash');
const { alphanumeric, numbers} = require('nanoid-dictionary');
const Storage = require('./storage');

function OTPStrategy(options, verify) {
  this.name = 'otp';

  this.options = options ? util._extend(options) : {};

  assert(has(this.options, ['sendOTP']));

  assert(has(this.options, 'redis') || has(this.options, 'mongodb'));
  this.options.storageType = has(this.options, 'redis') ? 'redis' : 'mongodb';
  this._storage = Storage(this.options.storageType, options);

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

  if (username && otp) {
    this.verifyOTP(username, otp);
  } else if (username) {
    this.startOTP(username);
  } else {
    return this.error('Could not authenticate! Please specify a username');
  }
};

OTPStrategy.prototype.startOTP = async function (username) {
  const that = this;
  const otp = this._nanoid();
  this._storage
    .store(username, otp, this.options.tokenLifeTime || 15)
    .then(function () {
      that.options
        .sendOTP(username, otp)
        .then(function () {
          that.pass();
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
  if (record) {
    if (this.options.storageType === 'redis') {
      return record === otp;
    } else if (record.expiredAt >= new Date()) {
      return record.otp === otp;
    }
  }
  return false;
};

OTPStrategy.prototype.verifyOTP = function (username, otp) {
  var that = this;
  this._storage.get(username).then((record) => {
    const valid = this.isValidOTP(record, otp);
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
        return self.error(ex);
      }
    } else {
      const e = new Error();
      e.status = 400;
      e.message = 'Invallid otp';
      that.error(e);
    }
  });
};

module.exports = OTPStrategy;
