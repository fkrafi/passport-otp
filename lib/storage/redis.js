const redis = require('redis');

module.exports = function init(redisUrl) {
  return redis.createClient(redisUrl);
};
