var _ = require('underscore');
module.exports = function(environments, status) {
  environments = environments || ['production'];
  status = status || 302;
  return function(req, res, next) {
    if (_.contains(environments, process.env.NODE_ENV)) {
      if (req.headers['x-forwarded-proto'] != 'https') {
        res.redirect(status, 'https://' + req.headers.host + req.originalUrl);
      }
      else {
        next();
      }
    }
    else {
      next();
    }
  };
};
