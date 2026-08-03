import pino from 'pino';
import chalk from 'chalk';
import util from 'node:util';

const logger = pino(
  {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
  pino.destination({ sync: false }),
);

const formatArg = (...args: any[]) => {
  return args.map((a) => (typeof a === 'object' ? util.inspect(a, { depth: null, colors: true }) : a)).join(' ');
};

export const log = {
  info: (...msg: any[]) => {
    logger.info(`[${new Date().toUTCString()}]: ` + formatArg(msg));
  },

  error: (...error: any[]) => {
    logger.error(`[${new Date().toUTCString()}]: ` + chalk.red(formatArg(error)));
  },

  debug: (...msg: any[]) => {
    logger.debug(`[${new Date().toUTCString()}]: ` + chalk.gray(formatArg(msg)));
  },
};
