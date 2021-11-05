import * as path from 'path';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from './constants';

process.env.IS_CI_SERVER_TEST_DEBUGGER = '';
process.env.VSC_PYTHON_CI_TEST = '1';
const workspacePath = path.join(__dirname, '..', '..', 'src', 'test');
const extensionDevelopmentPath = process.env.CODE_EXTENSIONS_PATH
    ? process.env.CODE_EXTENSIONS_PATH
    : EXTENSION_ROOT_DIR_FOR_TESTS;

const channel = process.env.VSC_PYTHON_CI_TEST_VSC_CHANNEL || 'stable';

async function start() {
    console.log('*'.repeat(100));
    console.log('Start Standard tests');
    await downloadAndUnzipVSCode(channel);
    const baseLaunchArgs = ['--disable-extensions'];
    const launchArgs = baseLaunchArgs.concat([workspacePath]).concat(['--timeout', '5000']);
    console.log(`Starting vscode ${channel} with args ${launchArgs.join(' ')}`);
    await runTests({
        extensionDevelopmentPath: extensionDevelopmentPath,
        extensionTestsPath: path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'out', 'test'),
        launchArgs,
        version: channel,
        extensionTestsEnv: { ...process.env, UITEST_DISABLE_INSIDERS: '1' },
    });
}
start().catch((ex) => {
    console.error('End Standard tests (with errors)', ex);
    process.exit(1);
});
