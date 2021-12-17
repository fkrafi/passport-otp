const Redis = require('ioredis');
var Cache = require('ttl');

function Storage(redisConfig) {
  var storage;
  var storageType = 'inmemory';

  function init() {
    if (redisConfig) {
      storageType = 'redis';
      storage = new Redis(redisConfig);
    } else {
      storage = new Cache();
    }
  }

  function store(key, otp, tokenLifeTime) {
    if (storageType === 'redis') {
      return storage.set(key, otp, 'EX', tokenLifeTime);
    } else {
      return key, otp, null, tokenLifeTime;
    }
  }

  function get(username) {
    if (storageType !== 'inmemory') {
      return new Promise((resolve, reject) => {
        storage.get(username, function (err, otp) {
          if (!err && otp) {
            return resolve(otp);
          }
          return reject(err);
        });
      });
    }
    return new Promise((resolve, reject) => {
      const res = storage.get(username);
      return res ? resolve(res) : reject();
    });
  }

  function del(username) {
    storage.del(username);
  }

  init();

  return {
    store,
    get,
    del,
  };
}

module.exports = Storage;
