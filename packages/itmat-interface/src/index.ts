// eslint:disable: no-console
import { Express } from 'express';
import { Socket } from 'net';
import http from 'http';
import ITMATInterfaceRunner from './interfaceRunner';
import config from './utils/configManager';

let interfaceRunner = new ITMATInterfaceRunner(config);
let interfaceSockets: Socket[] = [];
let interfaceServer: http.Server;
let interfaceRouter: Express;

function serverStart() {
    console.info(`Starting api server ${process.pid} ...`);
    interfaceRunner.start().then((itmatRouter) => {

        interfaceServer = itmatRouter.getServer();
        interfaceServer.timeout = 0;
        interfaceServer.headersTimeout = 0;
        interfaceServer.requestTimeout = 0;
        interfaceServer.keepAliveTimeout = 1000 * 60 * 60 * 24 * 5;
        interfaceServer.listen(config.server.port, () => {
            console.info(`Listening at http://localhost:${config.server.port}/`);
        })
            .on('connection', (socket) => {
                socket.setKeepAlive(true);
                socket.setNoDelay(true);
                socket.setTimeout(0);
                (socket as any).timeout = 0;
                interfaceSockets.push(socket);
            })
            .on('error', (error) => {
                if (error) {
                    console.error('An error occurred while starting the HTTP server.', error);
                    return;
                }
            });

        const interfaceRouterProxy = itmatRouter.getProxy();
        if (interfaceRouterProxy?.upgrade)
            interfaceServer.on('upgrade', interfaceRouterProxy?.upgrade);

    }).catch((error) => {
        console.error('An error occurred while starting the ITMAT core.', error);
        if (error.stack)
            console.error(error.stack);
        setTimeout(serverStart, 5000);
        return false;
    });
}

function serverSpinning() {

    if (interfaceRouter !== undefined) {
        console.info('Renewing api server ...');
        interfaceRunner = new ITMATInterfaceRunner(config);
        console.info(`Destroying ${interfaceSockets.length} sockets ...`);
        interfaceSockets.forEach((socket) => {
            socket.destroy();
        });
        interfaceSockets = [];
        interfaceServer.close(() => {
            console.info(`Shuting down api server ${process.pid} ...`);
            interfaceRouter?.on('close', () => {
                serverStart();
            }) || serverStart();
        });
    } else {
        serverStart();
    }
}

serverSpinning();

declare const module: any;
if (module.hot) {
    module.hot.accept('./index', serverSpinning);
    module.hot.accept('./interfaceRunner', serverSpinning);
    module.hot.accept('./index.ts', serverSpinning);
    module.hot.accept('./interfaceRunner.ts', serverSpinning);
}
