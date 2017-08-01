if (!global.logger) {
  const winston = require('winston');
  const expressWinston = require('express-winston')

  const transports = [
    new (winston.transports.Console)({
      colorize: true,
      timestamp: true,
      prettyPrint: true,
    }),
  ];

  if (process.env.LOG_FILE) {
    require('winston-daily-rotate-file');
    transports.push(new winston.transports.DailyRotateFile({
      filename: process.env.LOG_FILE,
      datePattern: 'yyyy-MM-dd',
      json: !!process.env.LOG_JSON,
    }));
  }

  if (process.env.EMAIL_TO) {
    const stringify = require('json-stringify-safe');
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

  global.logger = new (winston.Logger)({
    transports,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'debug'),
  });

  global.expressLogger = expressWinston.logger({
    transports,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}",
    expressFormat: true,
    colorize: true,
  });
}
