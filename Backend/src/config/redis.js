const { env } = require("./env");

let redisInstance;

const getRedisClient = () => {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisInstance) {
    const Redis = require("ioredis");

    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null
    });
  }

  return redisInstance;
};

module.exports = {
  getRedisClient
};
