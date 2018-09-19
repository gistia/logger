if (!global.logger) {
  const winston = require('winston');
  const expressWinston = require('express-winston');
  const _ = require('lodash');
  const CircularJSON = require('circular-json');

  const transports = [];

  if (process.env.LOGGER_SYSLOG_APP_NAME) {
    require('winston-syslog');
    transports.push(new (winston.transports.Syslog)({
      app_name: process.env.LOGGER_SYSLOG_APP_NAME,
      host: process.env.LOGGER_SYSLOG_HOST || 'localhost',
      port: process.env.LOGGER_SYSLOG_PORT || 514,
      protocol: process.env.LOGGER_SYSLOG_PROTOCOL || 'unix',
      path: process.env.LOGGER_SYSLOG_PATH || '/dev/log',
      type: process.env.LOGGER_SYSLOG_TYPE || 'BSD',
      eol: process.env.LOGGER_SYSLOG_EOL || '\n'
    }));
  }

  if (process.env.LOG_FILE) {
    require('winston-daily-rotate-file');
    console.log('[logger] File enabled. Prefix:', process.env.LOG_FILE, 'JSON:', process.env.LOG_JSON ? 'yes' : 'no');
    transports.push(new winston.transports.DailyRotateFile({
      filename: process.env.LOG_FILE,
      datePattern: 'yyyy-MM-dd',
      json: !!process.env.LOG_JSON,
    }));
  }

  if (process.env.LOG_LOGGLY_SUBDOMAIN) {
    require('winston-loggly-bulk');
    console.log('[logger] Loggly enabled. Subdomain:', process.env.LOG_LOGGLY_SUBDOMAIN, 'Tags:', process.env.LOG_LOGGLY_TAGS, 'TokenSet:', process.env.LOG_LOGGLY_TOKEN ? 'yes' : 'no');
    const tags = (process.env.LOG_LOGGLY_TAGS || '').split(',');
    transports.push(new winston.transports.Loggly({
      token: process.env.LOG_LOGGLY_TOKEN,
      subdomain: process.env.LOG_LOGGLY_SUBDOMAIN,
      tags,
      json: true,
    }));
  }

  if (process.env.LOG_SENTRY_DSN) {
    console.log('[logger] Sentry enabled. Subdomain:', process.env.LOG_SENTRY_DSN, 'Tags:', process.env.LOG_SENTRY_TAGS);
    const Sentry = require('winston-sentry');
    transports.push(new Sentry({
      level: 'error',
      dsn: process.env.LOG_SENTRY_DSN,
      tags: { key: process.env.LOG_SENTRY_TAGS },
      patchGlobal: true,
    }));
  }

  if (process.env.EMAIL_TO) {
    const stringify = require('json-stringify-safe');
    console.log('[logger] Email enabled. To:', process.env.EMAIL_TO, 'Host:', process.env.EMAIL_SMTP_HOST);
    require('winston-mail').Mail;
    transports.push(new winston.transports.Mail({
      level: 'error',
      to: process.env.EMAIL_TO,
      host: process.env.EMAIL_SMTP_HOST,
      port: process.env.EMAIL_SMTP_PORT,
      username: process.env.EMAIL_SMTP_USERNAME,
      password: process.env.EMAIL_SMTP_PASSWORD,
      subject: `[${process.env.EMAIL_APP_KEYWORD}] - Error: {{msg}}`,
      tls: !!process.env.EMAIL_SMTP_TLS,
      html: true,
      formatter: ({ _level, message, meta }) => {
        let body = `<p><b>Error: ${message}</b></p>`;

        if (meta && meta.stack) {
          body += `<p><b>Stack trace:</b><pre>
${meta.stack}
</pre></p>`;
        }

        if (meta) {
          body += `<p><b>Metadata:</b><pre>
${stringify(meta, null, 2)}
</pre></p>`;
        }

        return body;
      },
    }));
  }

  if (transports.length == 0
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test') {
    transports.push(new (winston.transports.Console)({
      timestamp: true,
      colorize: true,
      prettyPrint: true,
    }));
  }



  global.logger = new (winston.Logger)({
    transports,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'debug'),
  });

  function remove(obj, keys) {
    if (_.isArray(obj)) { return obj.forEach(obj => remove(obj, keys)); }
    for (prop in obj) {
      keys.forEach(key => {
        const raw = key.split('.')[0];
        if (prop === raw) {
          obj[raw] = undefined;
          delete obj[raw];
        } else if (_.isArray(obj[raw])) {
          obj[raw].forEach(obj => remove(obj, keys));
        } else if (_.isObject(obj[raw])) {
          remove(obj[raw], keys);
        }
      });
    }
    return obj;
  };

  global.logger.log = function() {
    const args = arguments;
    const lastArgument = args[args.length-1];
    const shouldCast = _.isObject(lastArgument) && (!_.isError(lastArgument) || lastArgument.config );
    const last = shouldCast ?
      remove(JSON.parse(CircularJSON.stringify(lastArgument)), ['client', '_id._bsontype', 'request']) :
      lastArgument;
    args[args.length-1] = last;
    winston.Logger.prototype.log.apply(this, args);
  };

  global.expressLogger = expressWinston.logger({
    transports,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}",
    expressFormat: true,
    colorize: true,
  });
}
