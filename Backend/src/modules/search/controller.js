const searchService = require("./service");

const search = async (req, res, next) => {
  try {
    const result = await searchService.search({
      query: req.query,
      user: req.user
    });

    res.status(200).json({
      status: "success",
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  search
};
