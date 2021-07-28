const mongoose = require('mongoose');

module.exports = function init(connectionURI) {
  mongoose.connect(connectionURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const OTPModel = mongoose.model(
    'OTP',
    new mongoose.Schema(
      {
        username: { type: String, require: true },
        otp: { type: String, require: true },
        expiredAt: { type: Date, require: true },
      },
      { timestamps: true }
    )
  );

  return OTPModel;
};
