import chalk from 'chalk';

export class Logger {
    public static log(message: any): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        console.log(`[${new Date().toUTCString()}] ${message}`);
    }

    public static warn(message: any): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        console.log(`[${new Date().toUTCString()}] ${chalk.bold.yellow('WARN!')} ${message}`);
    }

    public static error(message: any): void {
        if (message instanceof Object) { message = JSON.stringify(message, null, '\t'); }
        console.log(`[${new Date().toUTCString()}] ${chalk.bold.red('ERROR!')} ${message}`);
    }
}