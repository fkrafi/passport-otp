function Storage(storageType, { redis: redisUrl, mongodb: mongoConURI }) {
  var storage;

  function init() {
    if (storageType === 'redis') {
      storage = require('./redis')(redisUrl);
    } else {
      storage = require('./mongodb')(mongoConURI);
    }
  }

  function store(username, otp, tokenLifeTime) {
    if (storageType === 'redis') {
      return new Promise(function (resolve, reject) {
        storage
          .multi()
          .set(username, otp)
          .expire(username, tokenLifeTime)
          .exec(function (err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
      });
    } else {
      const expiredAt = new Date(new Date().getTime() + tokenLifeTime * 60000);
      return new Promise(function (resolve, reject) {
        storage
          .updateOne({ username }, { username, otp, expiredAt }, { upsert: true })
          .then(() => {
            resolve();
          })
          .catch((err) => {
            reject(err);
          });
      });
    }
  }

  function get(username) {
    if (storageType === 'redis') {
      return new Promise((resolve) => {
        return resolve(storage.get(username));
      });
    } else {
      return storage.findOne({ username }).lean();
    }
  }

  init();

  return {
    store,
    get,
  };
}

module.exports = Storage;
