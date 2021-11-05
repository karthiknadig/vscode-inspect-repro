import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';

export const PYTHON_VIRTUAL_ENVS_LOCATION = process.env.PYTHON_VIRTUAL_ENVS_LOCATION;
export const IS_APPVEYOR = process.env.APPVEYOR === 'true';
export const IS_TRAVIS = process.env.TRAVIS === 'true';
export const IS_VSTS = process.env.TF_BUILD !== undefined;
export const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
export const IS_CI_SERVER = IS_TRAVIS || IS_APPVEYOR || IS_VSTS || IS_GITHUB_ACTIONS;

export const TEST_TIMEOUT = 25000;
export const TEST_RETRYCOUNT = 3;

let reportJunit: boolean = false;
if (IS_CI_SERVER && process.env.MOCHA_REPORTER_JUNIT !== undefined) {
    reportJunit = process.env.MOCHA_REPORTER_JUNIT.toLowerCase() === 'true';
}
export const MOCHA_REPORTER_JUNIT: boolean = reportJunit;

type SetupOptions = Mocha.MochaOptions & {
    testFilesSuffix: string;
    reporterOptions?: {
        mochaFile?: string;
        properties?: string;
    };
    exit: boolean;
};

/**
 * Configure the test environment and return the optoins required to run moch tests.
 *
 * @returns {SetupOptions}
 */
function configure(): SetupOptions {
    process.env.VSC_PYTHON_CI_TEST = '1';
    process.env.IS_MULTI_ROOT_TEST = '0';

    // Check for a grep setting. Might be running a subset of the tests
    const defaultGrep = process.env.VSC_PYTHON_CI_TEST_GREP;
    // Check whether to invert the grep (i.e. test everything that doesn't include the grep).
    const invert = (process.env.VSC_PYTHON_CI_TEST_INVERT_GREP || '').length > 0;

    // If running on CI server and we're running the debugger tests, then ensure we only run debug tests.
    // We do this to ensure we only run debugger test, as debugger tests are very flaky on CI.
    // So the solution is to run them separately and first on CI.
    const grep = defaultGrep;
    const testFilesSuffix = process.env.TEST_FILES_SUFFIX || 'test';

    const options: SetupOptions & { retries: number; invert: boolean } = {
        ui: 'tdd',
        useColors: true,
        invert,
        timeout: TEST_TIMEOUT,
        retries: TEST_RETRYCOUNT,
        grep,
        testFilesSuffix,
        // Force Mocha to exit after tests.
        // It has been observed that this isn't sufficient, hence the reason for src/test/common/exitCIAfterTestReporter.ts
        exit: true,
    };

    // If the `MOCHA_REPORTER_JUNIT` env var is true, set up the CI reporter for
    // reporting to both the console (spec) and to a JUnit XML file. The xml file
    // written to is `test-report.xml` in the root folder by default, but can be
    // changed by setting env var `MOCHA_FILE` (we do this in our CI).
    if (MOCHA_REPORTER_JUNIT) {
        options.reporter = 'mocha-multi-reporters';
        const reporterPath = path.join(__dirname, 'common', 'exitCIAfterTestReporter.js');
        options.reporterOptions = {
            reporterEnabled: `spec,mocha-junit-reporter,${reporterPath}`,
        };
    }

    // Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY.
    // Since we are not running in a tty environment, we just implement the method statically.
    const tty = require('tty');
    if (!tty.getWindowSize) {
        tty.getWindowSize = () => [80, 75];
    }

    return options;
}

export async function run(): Promise<void> {
    const options = configure();
    const mocha = new Mocha(options);
    const testsRoot = path.join(__dirname);

    const testFiles = await new Promise<string[]>((resolve, reject) => {
        glob(`**/**.test.js`, { cwd: testsRoot }, (error: unknown, files: string[] | PromiseLike<string[]>) => {
            if (error) {
                return reject(error);
            }
            resolve(files);
        });
    });

    // Setup test files that need to be run.
    testFiles.forEach((file) => mocha.addFile(path.join(testsRoot, file)));

    console.time('Time taken to activate the extension');
    try {
        const extension = vscode.extensions.getExtension('vscode-inspect-repro');
        await extension?.activate();
        console.timeEnd('Time taken to activate the extension');
    } catch (ex) {
        console.error('Failed to activate python extension without errors', ex);
    }

    // Run the tests.
    await new Promise<void>((resolve, reject) => {
        mocha.run((failures) => {
            if (failures > 0) {
                return reject(new Error(`${failures} total failures`));
            }
            resolve();
        });
    });
}
