const authService = require("./service");
const {
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshCookieBaseOptions,
  getRefreshCookieOptions
} = require("../../utils/auth");
const { getClientIp, getUserAgent } = require("../../utils/request");

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, getRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getRefreshCookieBaseOptions());
};

const register = async (req, res, next) => {
  try {
    const result = await authService.register({
      actorUserId: req.user.userId,
      ...req.body,
      ipAddress: getClientIp(req)
    });

    res.status(201).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login({
      ...req.body,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      status: "success",
      data: {
        accessToken: result.accessToken,
        token: result.accessToken,
        user: result.user
      }
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refresh({
      refreshToken: req.cookies[REFRESH_TOKEN_COOKIE_NAME]
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
};

const session = async (req, res, next) => {
  const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

  if (!refreshToken) {
    res.status(200).json({
      status: "success",
      data: {
        authenticated: false,
        accessToken: null,
        token: null,
        user: null
      }
    });
    return;
  }

  try {
    const result = await authService.refresh({ refreshToken });

    res.status(200).json({
      status: "success",
      data: {
        authenticated: true,
        accessToken: result.accessToken,
        token: result.accessToken,
        user: result.user
      }
    });
  } catch (error) {
    if (error.statusCode === 401) {
      clearRefreshCookie(res);
      res.status(200).json({
        status: "success",
        data: {
          authenticated: false,
          accessToken: null,
          token: null,
          user: null
        }
      });
      return;
    }

    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout({
      refreshToken: req.cookies[REFRESH_TOKEN_COOKIE_NAME],
      ipAddress: getClientIp(req)
    });

    clearRefreshCookie(res);

    res.status(200).json({
      status: "success",
      data: {
        message: "Logout successful."
      }
    });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const result = await authService.getMe({
      userId: req.user.userId
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  me,
  refresh,
  register,
  session
};
