import fs from 'fs';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import context from '../utils/context';
import handleCollectRoute from '../utils/handleCollectRoute';
import getEnv from '../utils/getEnv';
import configFactory from '../config/webpack.config';

const openBrowser = require('../dev-utils/openBrowser');
const paths = require('../config/paths');
const { choosePort, createCompiler, prepareUrls } = require('../dev-utils/WebpackDevServerUtils');
const createDevServerConfig = require('../config/webpackDevServer.config');

export default function start(program) {
  // 初始化全局参数context
  const { initContext } = context;
  initContext(program, true);

  const {
    choerodonConfig: {
      entryName, port: defaultPort,
    },
  } = context;
  // 收集路由，单模块启动也得配置路径
  handleCollectRoute(entryName);

  const useYarn = fs.existsSync(paths.yarnLockFile);

  // Warn and crash if required files are missing
  // if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  //   process.exit(1);
  // }

  // Tools like Cloud9 rely on this.
  const DEFAULT_PORT = parseInt(defaultPort, 10) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  // We attempt to use the default port but if it is busy, we offer the user to
  // run on a different port. `choosePort()` Promise resolves to the next free port.
  choosePort(HOST, DEFAULT_PORT)
    .then((port) => {
      if (port == null) {
      // We have not found a port.
        return;
      }
      const config = configFactory('start', 'development', getEnv());
      const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
      const appName = require(paths.appPackageJson).name;
      const useTypeScript = fs.existsSync(paths.appTsConfig);
      const tscCompileOnError = process.env.TSC_COMPILE_ON_ERROR === 'true';
      const urls = prepareUrls(
        protocol,
        HOST,
        port,
      );
      const devSocket = {
        warnings: (warnings) => devServer.sockWrite(devServer.sockets, 'warnings', warnings),
        errors: (errors) => devServer.sockWrite(devServer.sockets, 'errors', errors),
      };
      // Create a webpack compiler that is configured with custom messages.
      const compiler = createCompiler({
        appName,
        config,
        devSocket,
        urls,
        useYarn,
        useTypeScript,
        tscCompileOnError,
        webpack,
      });
      // Serve webpack assets generated by the compiler over a web server.
      const serverConfig = createDevServerConfig(
        urls.lanUrlForConfig,
      );
      const devServer = new WebpackDevServer(compiler, serverConfig);
      // Launch WebpackDevServer.
      devServer.listen(port, HOST, (err) => {
        if (err) {
          return console.log(err);
        }
        openBrowser(urls.localUrlForBrowser);
      });

      ['SIGINT', 'SIGTERM'].forEach((sig) => {
        process.on(sig, () => {
          devServer.close();
          process.exit();
        });
      });
    });
}
